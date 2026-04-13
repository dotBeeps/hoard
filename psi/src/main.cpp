#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>

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

    SseConnection sse;
    sse.setBaseUrl(QUrl("http://localhost:7432"));

    ThoughtModel thoughts;
    DaemonState state;

    QObject::connect(&sse, &SseConnection::thoughtReceived,
                     &thoughts, [&thoughts](const QString &type, const QString &text) {
        thoughts.addThought(type, text);
    });
    QObject::connect(&sse, &SseConnection::thoughtReceived,
                     &state, &DaemonState::onThoughtReceived);
    QObject::connect(&sse, &SseConnection::stateReceived,
                     &state, &DaemonState::onStateReceived);
    QObject::connect(&sse, &SseConnection::connectedChanged,
                     &state, [&sse, &state]() {
        state.setConnected(sse.isConnected());
        if (sse.isConnected())
            state.pollState(sse.baseUrl());
    });

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty("Sse", &sse);
    engine.rootContext()->setContextProperty("Thoughts", &thoughts);
    engine.rootContext()->setContextProperty("State", &state);

    engine.loadFromModule("Psi", "Main");

    if (engine.rootObjects().isEmpty())
        return -1;

    sse.connectToServer();

    return QGuiApplication::exec();
}
