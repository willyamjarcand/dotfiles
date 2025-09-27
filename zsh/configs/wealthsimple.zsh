# Claude Code
export AWS_REGION='us-east-1'
export ANTHROPIC_MODEL='us.anthropic.claude-sonnet-4-20250514-v1:0'
export ANTHROPIC_SMALL_FAS2T_MODEL='us.anthropic.claude-3-5-haiku-20241022-v1:0'
export CLAUDE_CODE_USE_BEDROCK=1

source /Users/willyam.arcand/.config/wealthsimple/rbenv/config.zsh
source /Users/willyam.arcand/.config/wealthsimple/direnv/config.zsh
source /Users/willyam.arcand/.config/wealthsimple/nvm/config.zsh
eval "$(mise activate zsh)"
eval "$(ws hook zsh)"