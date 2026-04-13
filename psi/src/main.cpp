#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QtQml>

#include "daemonstate.h"
#include "sseconnection.h"
#include "thoughtmodel.h"
#include "themeengine.h"

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    QGuiApplication::setApplicationName("psi");
    QGuiApplication::setOrganizationName("hoard");

    QQuickStyle::setStyle("Material");

    // Create backend objects on the stack — they outlive the engine.
    auto *theme = new ThemeEngine(&app);
    auto *sse = new SseConnection(&app);
    sse->setBaseUrl(QUrl("http://localhost:7432"));

    auto *thoughts = new ThoughtModel(&app);
    auto *state = new DaemonState(&app);

    // Wire SSE events → model updates.
    QObject::connect(sse, &SseConnection::thoughtReceived,
                     thoughts, [thoughts](const QString &type, const QString &text) {
        thoughts->addThought(type, text);
    });
    QObject::connect(sse, &SseConnection::thoughtReceived,
                     state, &DaemonState::onThoughtReceived);
    QObject::connect(sse, &SseConnection::stateReceived,
                     state, &DaemonState::onStateReceived);
    QObject::connect(sse, &SseConnection::connectedChanged,
                     state, [sse, state]() {
        state->setConnected(sse->isConnected());
        if (sse->isConnected())
            state->pollState(sse->baseUrl());
    });

    // Register as QML singletons — more reliable than context properties in Qt 6.
    qmlRegisterSingletonInstance("Psi", 1, 0, "Theme", theme);
    qmlRegisterSingletonInstance("Psi", 1, 0, "Sse", sse);
    qmlRegisterSingletonInstance("Psi", 1, 0, "Thoughts", thoughts);
    qmlRegisterSingletonInstance("Psi", 1, 0, "State", state);

    QQmlApplicationEngine engine;
    engine.loadFromModule("Psi", "Main");

    if (engine.rootObjects().isEmpty())
        return -1;

    sse->connectToServer();

    return QGuiApplication::exec();
}
