#!/bin/bash
# sbx 作成後に自動実行されるセットアップスクリプトの例
# config.json の post_create_cmds で指定:
#   "post_create_cmds": [["~/src/claude-sbx/examples/sbx-setup.sh"]]

# --- dotfiles リンクの例 ---
# mounts で "~/dotfiles:ro" をマウントしておく
DOTFILES="$HOME/dotfiles"
if [ -d "$DOTFILES" ]; then
  ln -sf "$DOTFILES/.zshrc" ~/.zshrc
  ln -sf "$DOTFILES/.gitconfig" ~/.gitconfig
fi

echo "setup complete"
