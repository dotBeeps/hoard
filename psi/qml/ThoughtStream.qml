import QtQuick
import QtQuick.Controls.Material
import QtQuick.Layouts

Rectangle {
    id: streamRoot

    color: Theme.background

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        StreamFilter {
            Layout.fillWidth: true
            Layout.preferredHeight: 36
        }

        Rectangle {
            height: 1
            Layout.fillWidth: true
            color: Theme.border
        }

        ListView {
            id: streamView

            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            spacing: 2
            cacheBuffer: 2000

            model: Thoughts

            delegate: ThoughtDelegate {
                required property string type
                required property string text
                required property date timestamp
                required property string nerve
                width: streamView.width
            }

            onContentYChanged: {
                if (!streamView.atYEnd) {
                    Thoughts.autoScroll = false
                }
            }

            onCountChanged: {
                if (Thoughts.autoScroll) {
                    Qt.callLater(streamView.positionViewAtEnd)
                }
            }
        }

        Rectangle {
            visible: !Thoughts.autoScroll && Thoughts.count > 0
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 140
            Layout.preferredHeight: 28
            Layout.bottomMargin: 8
            radius: 14
            color: Theme.surfaceRaised
            border.width: 1
            border.color: Theme.border

            Text {
                anchors.centerIn: parent
                text: "scroll to bottom"
                font.pixelSize: 11
                color: Theme.textMuted
            }

            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                    Thoughts.autoScroll = true
                    streamView.positionViewAtEnd()
                }
            }
        }
    }
}
