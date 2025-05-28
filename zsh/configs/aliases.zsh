bindkey '^K' kill-whole-line

# Neovim socket functions
start_nvim() {
    CURRENT_DIR=$(basename "$PWD")
    SOCKET="/tmp/nvim-${CURRENT_DIR}"
    nvim --listen "$SOCKET"
}
alias vi='start_nvim'

# Function to get API key from macOS Keychain
get_openai_api_key() {
    security find-generic-password -a "$USER" -s "openai_api_key" -w 2>/dev/null
}

ai() {
    local api_key=$(get_openai_api_key)
    if [ -z "$api_key" ]; then
        echo "OpenAI API key not found in Keychain."
        echo "To add it, run: security add-generic-password -a $USER -s openai_api_key -w"
        return 1
    fi
    
    OPENAI_API_BASE=https://llm.w10e.com/api \
    aider --model openai/bedrock-claude-3.7-sonnet --api-key openai="$api_key"
}
