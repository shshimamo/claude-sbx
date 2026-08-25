#!/bin/sh
# sbx 内で実行する hooks セットアップスクリプト
# config.json の post_create_cmds で指定:
#   "post_create_cmds": [["~/.claude-sbx/setup_hooks.sh"]]

# マウントされた ~/.claude-sbx のパスを検出
SBX_DIR=$(mount | grep '\.claude-sbx ' | awk '{print $3}')
if [ -z "$SBX_DIR" ]; then
  echo "ERROR: ~/.claude-sbx is not mounted. Add it to config.json mounts."
  exit 1
fi

# --- notify.sh 作成 ---
mkdir -p "$SBX_DIR/bin"
cat > "$SBX_DIR/bin/notify.sh" << NOTIFY_SCRIPT
#!/bin/sh
# Claude Code hook から呼ばれ、stdin の JSON を丸ごとファイルに書く
EVENT="\$1"
INPUT=\$(cat)
SESSION_ID=\$(echo "\$INPUT" | grep -o '"session_id" *: *"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
[ -z "\$SESSION_ID" ] && exit 0
DIR="$SBX_DIR/sessions"
mkdir -p "\$DIR"
printf '{"event":"%s","data":%s}\n' "\$EVENT" "\$INPUT" > "\$DIR/\$SESSION_ID.json"
NOTIFY_SCRIPT
chmod +x "$SBX_DIR/bin/notify.sh"

# --- settings.json に hooks をマージ ---
SETTINGS="$HOME/.claude/settings.json"
mkdir -p ~/.claude

python3 -c "
import json

hooks = {
    'Stop': [{'matcher': '', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/notify.sh Stop'}]}],
    'PermissionRequest': [{'matcher': '', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/notify.sh PermissionRequest'}]}],
    'PreToolUse': [{'matcher': 'AskUserQuestion', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/notify.sh AskUserQuestion'}]}],
}

path = '$SETTINGS'
try:
    with open(path) as f:
        settings = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    settings = {}

if 'hooks' not in settings:
    settings['hooks'] = {}

for event, rules in hooks.items():
    if event not in settings['hooks']:
        settings['hooks'][event] = rules
    else:
        existing_cmds = [h.get('command', '') for r in settings['hooks'][event] for h in r.get('hooks', [])]
        for rule in rules:
            cmd = rule['hooks'][0]['command']
            if cmd not in existing_cmds:
                settings['hooks'][event].append(rule)

with open(path, 'w') as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write('\n')

print('hooks merged:', path)
"

echo "setup_hooks complete"
