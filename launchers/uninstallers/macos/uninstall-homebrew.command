#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCHERS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_DIR="$LAUNCHERS_DIR/macos/.state"
HOMEBREW_MARKER="$STATE_DIR/homebrew-installed-by-launcher"

pause_before_exit() {
    printf '\nНажмите Enter, чтобы закрыть окно...'
    read -r _ || true
}

ensure_brew_path() {
    if command -v brew >/dev/null 2>&1; then
        return 0
    fi

    if [ -x /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -x /usr/local/bin/brew ]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
}

echo "Lampa RUTUBE Proxy"
echo "Удаление Homebrew для macOS"
echo

ensure_brew_path

if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew не найден. Удалять нечего."
    rm -f "$HOMEBREW_MARKER"
    rmdir "$STATE_DIR" 2>/dev/null || true
    pause_before_exit
    exit 0
fi

if [ ! -f "$HOMEBREW_MARKER" ]; then
    echo "Этот проект не устанавливал Homebrew."
    echo "Homebrew может использоваться другими программами."
    echo
fi

echo "Будет запущен официальный деинсталлятор Homebrew."
echo "Он удаляет Homebrew и установленные через него пакеты."
echo
printf 'Удалить Homebrew? [y/N] '
read -r answer || true

case "$answer" in
    y|Y|yes|YES)
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"
        rm -f "$HOMEBREW_MARKER"
        rmdir "$STATE_DIR" 2>/dev/null || true
        echo
        echo "Деинсталлятор Homebrew завершил работу."
        ;;
    *)
        echo
        echo "Отменено."
        ;;
esac

pause_before_exit
