@file:Suppress("FunctionName", "ClassName", "unused", "EnumEntryName", "UnusedImport")
package com.sourcegraph.cody.agent.protocol_generated;

import com.google.gson.annotations.SerializedName;

data class SerializedChatMessage(
  val contextFiles: List<ContextItem>? = null,
  val error: ChatError? = null,
  val editorState: Any? = null,
  val speaker: SpeakerEnum, // Oneof: human, assistant, system
  val text: String? = null,
  val model: String? = null,
  val intent: IntentEnum? = null, // Oneof: search, chat, edit, insert
  val manuallySelectedIntent: ManuallySelectedIntentEnum? = null, // Oneof: search, chat, edit, insert
  val search: Any? = null,
  val didYouMeanQuery: String? = null,
  val agent: String? = null,
  val processes: List<ProcessingStep>? = null,
  val subMessages: List<SubMessage>? = null,
  val content: List<MessagePart>? = null,
) {

  enum class SpeakerEnum {
    @SerializedName("human") Human,
    @SerializedName("assistant") Assistant,
    @SerializedName("system") System,
  }

  enum class IntentEnum {
    @SerializedName("search") Search,
    @SerializedName("chat") Chat,
    @SerializedName("edit") Edit,
    @SerializedName("insert") Insert,
  }

  enum class ManuallySelectedIntentEnum {
    @SerializedName("search") Search,
    @SerializedName("chat") Chat,
    @SerializedName("edit") Edit,
    @SerializedName("insert") Insert,
  }
}

