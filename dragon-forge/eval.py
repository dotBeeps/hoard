#!/usr/bin/env python3
"""Evaluate the fine-tuned Ember LoRA adapter against probes.jsonl.

Loads the LoRA adapter from out/checkpoints/ember-lora/final/, runs each
probe through the combined persona+user-context system prompt, and writes
completions to out/eval/. Also prints a human-readable report to stdout.

Runtime: same Unsloth studio env as train.py:

    HIP_VISIBLE_DEVICES=0 ~/.unsloth/studio/unsloth_studio/bin/python eval.py

Usage:
    python eval.py                          # all 23 probes
    python eval.py --categories containment_deliberate safety_redirect
    python eval.py --ids 14 15 16 18
    python eval.py --adapter path/to/other/adapter
    python eval.py --temp 0.7 --max-new-tokens 600
"""

from __future__ import annotations

from unsloth import FastLanguageModel  # noqa: I001 (order-sensitive)

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROBES_PATH = SCRIPT_DIR / "probes.jsonl"
PERSONA_PATH = SCRIPT_DIR / "config" / "persona.md"
USER_CONTEXT_PATH = SCRIPT_DIR / "config" / "user-context.md"
DEFAULT_ADAPTER = SCRIPT_DIR / "out" / "checkpoints" / "ember-lora" / "final"
EVAL_DIR = SCRIPT_DIR / "out" / "eval"

# Must match train.py's INSTRUCTION_PART / RESPONSE_PART so the chat
# template renders identically at inference time.
INSTRUCTION_PART = "<|im_start|>user\n"
RESPONSE_PART = "<|im_start|>assistant\n"


def load_system_prompt() -> str:
    if not PERSONA_PATH.exists():
        sys.exit(f"persona spec not found at {PERSONA_PATH}")
    if not USER_CONTEXT_PATH.exists():
        sys.exit(f"user context not found at {USER_CONTEXT_PATH}")
    persona = PERSONA_PATH.read_text(encoding="utf-8").strip()
    user_ctx = USER_CONTEXT_PATH.read_text(encoding="utf-8").strip()
    return f"{persona}\n\n---\n\n{user_ctx}"


def load_probes(
    ids: list[int] | None,
    categories: list[str] | None,
) -> list[dict]:
    if not PROBES_PATH.exists():
        sys.exit(f"probes not found at {PROBES_PATH}")
    probes = []
    with open(PROBES_PATH, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            d = json.loads(line)
            if ids and d["id"] not in ids:
                continue
            if categories and d["category"] not in categories:
                continue
            probes.append(d)
    return probes


def generate(
    model,
    tokenizer,
    system_prompt: str,
    user_prompt: str,
    max_new_tokens: int,
    temperature: float,
    top_p: float,
) -> tuple[str, float]:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    input_text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = tokenizer(input_text, return_tensors="pt").to("cuda")
    input_len = inputs["input_ids"].shape[1]

    t0 = time.perf_counter()
    with __import__("torch").no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id,
        )
    elapsed = time.perf_counter() - t0

    new_tokens = output_ids[0][input_len:]
    completion = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
    return completion, elapsed


def print_divider(label: str = "") -> None:
    width = 72
    if label:
        pad = (width - len(label) - 2) // 2
        print(f"{'─' * pad} {label} {'─' * (width - pad - len(label) - 2)}")
    else:
        print("─" * width)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--adapter",
        default=str(DEFAULT_ADAPTER),
        help="Path to the LoRA adapter directory",
    )
    ap.add_argument(
        "--base-model",
        default="unsloth/Hermes-3-Llama-3.1-8B-bnb-4bit",
        help="Base model to load before applying the adapter",
    )
    ap.add_argument("--max-seq-length", type=int, default=4096)
    ap.add_argument(
        "--max-new-tokens",
        type=int,
        default=512,
        help="Max tokens to generate per probe",
    )
    ap.add_argument(
        "--temp",
        type=float,
        default=0.8,
        help="Sampling temperature (0 = greedy)",
    )
    ap.add_argument("--top-p", type=float, default=0.95)
    ap.add_argument(
        "--ids",
        type=int,
        nargs="+",
        help="Run only these probe IDs",
    )
    ap.add_argument(
        "--categories",
        nargs="+",
        help="Run only probes in these categories",
    )
    ap.add_argument(
        "--no-save",
        action="store_true",
        help="Print to stdout only, don't write output files",
    )
    args = ap.parse_args()

    adapter_path = Path(args.adapter)
    if not adapter_path.exists():
        sys.exit(f"adapter not found at {adapter_path} — run train.py first")

    system_prompt = load_system_prompt()
    probes = load_probes(
        ids=args.ids,
        categories=args.categories,
    )
    if not probes:
        sys.exit("no probes matched the given filters")

    print(f"loading base model + adapter from {adapter_path}…", file=sys.stderr)
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(adapter_path),
        max_seq_length=args.max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)

    # Timestamp for output files
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    if not args.no_save:
        EVAL_DIR.mkdir(parents=True, exist_ok=True)
        jsonl_path = EVAL_DIR / f"completions-{ts}.jsonl"
        report_path = EVAL_DIR / f"report-{ts}.txt"
        jsonl_fh = open(jsonl_path, "w", encoding="utf-8")
        report_fh = open(report_path, "w", encoding="utf-8")
        print(f"writing completions → {jsonl_path}", file=sys.stderr)
        print(f"writing report     → {report_path}", file=sys.stderr)
    else:
        jsonl_fh = report_fh = None  # type: ignore[assignment]

    def emit(text: str) -> None:
        print(text)
        if report_fh:
            print(text, file=report_fh)

    print_divider()
    emit(
        f"Ember LoRA eval — {ts}\n"
        f"adapter: {adapter_path}\n"
        f"probes:  {len(probes)}  temp={args.temp}  top_p={args.top_p}  "
        f"max_new_tokens={args.max_new_tokens}"
    )
    print_divider()

    results = []
    for probe in probes:
        pid = probe["id"]
        cat = probe["category"]
        prompt = probe["prompt"]

        emit(f"\n[{pid:>2}] ({cat})\n> {prompt}\n")

        completion, elapsed = generate(
            model=model,
            tokenizer=tokenizer,
            system_prompt=system_prompt,
            user_prompt=prompt,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temp,
            top_p=args.top_p,
        )

        emit(completion)
        emit(f"\n  [{elapsed:.1f}s]")
        print_divider()

        row = {
            "id": pid,
            "category": cat,
            "prompt": prompt,
            "completion": completion,
            "elapsed_s": round(elapsed, 2),
        }
        results.append(row)
        if jsonl_fh:
            print(json.dumps(row, ensure_ascii=False), file=jsonl_fh)
            jsonl_fh.flush()

    # Summary
    total = sum(r["elapsed_s"] for r in results)
    emit(
        f"\n{len(results)} probes  {total:.1f}s total  "
        f"({total/len(results):.1f}s avg per probe)"
    )

    if jsonl_fh:
        jsonl_fh.close()
    if report_fh:
        report_fh.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
