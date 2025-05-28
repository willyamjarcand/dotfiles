bindkey '^K' kill-whole-line

# Neovim socket functions
start_nvim() {
    CURRENT_DIR=$(basename "$PWD")
    SOCKET="/tmp/nvim-${CURRENT_DIR}"
    nvim --listen "$SOCKET"
}
alias vi='start_nvim'

ai() {
    OPENAI_API_BASE=https://llm.w10e.com/api \
    aider --model openai/bedrock-claude-3.7-sonnet --api-key openai=$OPENAI_API_KEY
}
