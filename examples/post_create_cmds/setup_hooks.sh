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

# --- notify.sh 作成 (OS通知用) ---
mkdir -p "$SBX_DIR/bin"
cat > "$SBX_DIR/bin/notify.sh" << NOTIFY_SCRIPT
#!/bin/sh
# OS通知用: stdin の JSON を notifications/ に書く
EVENT="\$1"
INPUT=\$(cat)
CLAUDE_SBX_ID_VAL=\${CLAUDE_SBX_ID:-}
NOTIFY_DIR="$SBX_DIR/notifications"
mkdir -p "\$NOTIFY_DIR"
NOTIFY_FILE="\$NOTIFY_DIR/\$(date +%s%N)-\$\$.json"
printf '{"event":"%s","claude_sbx_id":"%s","data":%s}\n' "\$EVENT" "\$CLAUDE_SBX_ID_VAL" "\$INPUT" > "\$NOTIFY_FILE"
NOTIFY_SCRIPT
chmod +x "$SBX_DIR/bin/notify.sh"

# --- state.sh 作成 (状態更新用) ---
cat > "$SBX_DIR/bin/state.sh" << STATE_SCRIPT
#!/bin/sh
# 状態更新用: stdin の JSON を states/ に書く
EVENT="\$1"
INPUT=\$(cat)
CLAUDE_SBX_ID_VAL=\${CLAUDE_SBX_ID:-}
[ -z "\$CLAUDE_SBX_ID_VAL" ] && exit 0
STATE_DIR="$SBX_DIR/states"
mkdir -p "\$STATE_DIR"
STATE_FILE="\$STATE_DIR/\$(date +%s%N)-\$\$.json"
printf '{"event":"%s","claude_sbx_id":"%s","data":%s}\n' "\$EVENT" "\$CLAUDE_SBX_ID_VAL" "\$INPUT" > "\$STATE_FILE"
STATE_SCRIPT
chmod +x "$SBX_DIR/bin/state.sh"

# --- settings.json に hooks をマージ ---
SETTINGS="$HOME/.claude/settings.json"
mkdir -p ~/.claude

python3 -c "
import json

hooks = {
    'Stop': [
        {'matcher': '', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/notify.sh Stop'}]},
        {'matcher': '', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/state.sh Stop'}]},
    ],
    'PermissionRequest': [
        {'matcher': '', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/notify.sh PermissionRequest'}]},
        {'matcher': '', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/state.sh PermissionRequest'}]},
    ],
    'PreToolUse': [
        {'matcher': 'AskUserQuestion', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/notify.sh AskUserQuestion'}]},
        {'matcher': 'AskUserQuestion', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/state.sh AskUserQuestion'}]},
    ],
    'UserPromptSubmit': [
        {'matcher': '', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/state.sh UserPromptSubmit'}]},
    ],
    'PostToolUse': [
        {'matcher': '', 'hooks': [{'type': 'command', 'command': '$SBX_DIR/bin/state.sh PostToolUse'}]},
    ],
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
