#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCHERS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_DIR="$LAUNCHERS_DIR/macos/.state"
PHP_MARKER="$STATE_DIR/php-installed-by-launcher"
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
echo "Удаление PHP для macOS"
echo

ensure_brew_path

if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew не найден. Удалять нечего."
    rm -rf "$STATE_DIR"
    pause_before_exit
    exit 0
fi

if [ ! -f "$PHP_MARKER" ]; then
    echo "Этот проект не устанавливал PHP через Homebrew, поэтому PHP не будет удален."
    echo "Так мы не трогаем PHP, который мог быть установлен для других проектов."
    echo
    if [ -f "$HOMEBREW_MARKER" ]; then
        echo "Homebrew был установлен запускателем. Для его удаления используйте:"
        echo "  launchers/uninstallers/macos/uninstall-homebrew.command"
    fi
    pause_before_exit
    exit 0
fi

echo "Будет удален Homebrew-пакет php, установленный этим запускателем."
echo "Homebrew и другие пакеты не удаляются."
echo
printf 'Удалить PHP? [y/N] '
read -r answer || true

case "$answer" in
    y|Y|yes|YES)
        brew uninstall php
        rm -f "$PHP_MARKER"
        rmdir "$STATE_DIR" 2>/dev/null || true
        echo
        echo "PHP удален."
        ;;
    *)
        echo
        echo "Отменено."
        ;;
esac

pause_before_exit
