package com.sourcegraph.cody.chat

import com.intellij.openapi.actionSystem.AnActionEvent
import com.sourcegraph.cody.CodyToolWindowContent
import com.sourcegraph.common.ui.DumbAwareEDTAction

class OpenChatAction : DumbAwareEDTAction("Open Cody") {

  override fun actionPerformed(event: AnActionEvent) {
    val project = event.project ?: return
    CodyToolWindowContent.show(project)
  }
}
