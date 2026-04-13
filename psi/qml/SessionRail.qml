import QtQuick
import QtQuick.Controls.Material
import QtQuick.Layouts

Rectangle {
    color: Theme.surface

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 4
        spacing: 8

        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 40
            Layout.preferredHeight: 40
            radius: 8
            color: Theme.surfaceRaised
            border.width: 2
            border.color: Theme.tierDragon

            Text {
                anchors.centerIn: parent
                text: "E"
                font.pixelSize: 18
                font.bold: true
                color: Theme.text
            }

            Rectangle {
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                anchors.margins: -2
                width: 10
                height: 10
                radius: 5
                color: Daemon.connected ? "#4ade80" : "#ef4444"
                border.width: 1
                border.color: Theme.surface
            }
        }

        Item { Layout.fillHeight: true }

        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 40
            Layout.preferredHeight: 40
            radius: 8
            color: "transparent"
            border.width: 1
            border.color: Theme.border

            Text {
                anchors.centerIn: parent
                text: "+"
                font.pixelSize: 20
                color: Theme.textDim
            }
        }
    }
}
