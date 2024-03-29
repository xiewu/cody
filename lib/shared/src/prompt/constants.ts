export const ANSWER_TOKENS = 1000
export const MAX_HUMAN_INPUT_TOKENS = 1000
export const MAX_CURRENT_FILE_TOKENS = 1000
/**
 * A token is equivalent to 4 characters/bytes.
 */
export const CHARS_PER_TOKEN = 4
export const SURROUNDING_LINES = 50
export const NUM_CODE_RESULTS = 12
export const NUM_TEXT_RESULTS = 3

export const MAX_BYTES_PER_FILE = 4096

// CHAT MODEL TOKEN LIMITS
export const DEFAULT_CHAT_MODEL_TOKEN_LIMIT = 7000
export const DEFAULT_FAST_MODEL_TOKEN_LIMIT = 4096

/**
 * Calculate the number of characters from the number of tokens.
 */
// TODO: Users of this function need to specify the model as a parameter; tokenization can vary by model.
export function tokensToChars(tokenCount: number): number {
    return tokenCount * CHARS_PER_TOKEN
}
