using System.Text.Json.Serialization;

namespace Cody.Core.Agent.Protocol
{
  public class WebviewDidDisposeParams
  {
    [JsonProperty(PropertyName = "id")]
    public string Id { get; set; }
  }
}
