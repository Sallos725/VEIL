export const VEIL_SAMPLE_SECRETS = [
  {
    id: "sample_hidden_truth",
    title: "Sample Hidden Truth",
    scopeType: "character",
    scopeId: "sample_character",
    fullSecret:
      "The sample character already knows the truth, but is hiding it to protect the listener.",
    revealStage: "hint",
    revealLadder: {
      foreshadow: [
        "The character hesitates whenever the old incident is mentioned.",
      ],
      hint: ["The old incident was not as simple as it appeared."],
      partial: ["The character made a painful choice to protect someone."],
      nearReveal: ["The choice involved hiding the truth from the listener."],
      revealed:
        "The character already knew the truth and hid it to protect the listener.",
    },
    knownBy: ["sample_character", "narrator"],
    unknownBy: ["sample_listener"],
    allowedSpeakers: ["sample_character", "narrator"],
    blockedSpeakers: [],
    allowedListeners: [],
    blockedListeners: [],
    hardBlocks: ["already knows the truth", "hiding it to protect"],
    visibilityMode: "stage_guidance",
    tags: ["sample", "hidden-truth", "old incident"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "persona_private_note",
    title: "Persona Private Note",
    scopeType: "persona",
    scopeId: "sample_persona",
    fullSecret: "The persona secretly suspects the character is lying.",
    revealStage: "foreshadow",
    revealLadder: {
      foreshadow: ["The persona feels an unspoken doubt."],
      hint: ["Something in the story does not add up."],
    },
    knownBy: ["sample_persona", "narrator"],
    unknownBy: ["sample_character"],
    hardBlocks: ["secretly suspects", "character is lying"],
    visibilityMode: "stage_guidance",
    tags: ["persona", "doubt"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

export function cloneSampleSecrets() {
  return JSON.parse(JSON.stringify(VEIL_SAMPLE_SECRETS));
}
