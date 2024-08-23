using System.Text.Json.Serialization;

namespace Cody.Core.Agent.Protocol
{
  public class Repo
  {
    [JsonProperty(PropertyName = "name")]
    public string Name { get; set; }
    [JsonProperty(PropertyName = "id")]
    public string Id { get; set; }
  }
}
