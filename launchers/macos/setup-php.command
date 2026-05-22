#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="$SCRIPT_DIR/.state"
PHP_MARKER="$STATE_DIR/php-installed-by-launcher"
HOMEBREW_MARKER="$STATE_DIR/homebrew-installed-by-launcher"

pause_before_exit() {
    if [ "${LAMPA_NO_PAUSE:-0}" = "1" ]; then
        return
    fi

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

ensure_homebrew() {
    ensure_brew_path

    if command -v brew >/dev/null 2>&1; then
        return 0
    fi

    cat <<'EOF'
Homebrew не найден. Сейчас будет запущен официальный установщик Homebrew.
Он может запросить пароль macOS.
EOF
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    mkdir -p "$STATE_DIR"
    touch "$HOMEBREW_MARKER"

    ensure_brew_path
}

echo "Lampa RUTUBE Proxy"
echo "Установка PHP для macOS"
echo

ensure_homebrew || {
    echo
    echo "Не удалось установить или найти Homebrew."
    pause_before_exit
    exit 1
}

ensure_brew_path

if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew установлен, но команда brew пока не доступна в этом окне."
    echo "Закройте Терминал, откройте заново и запустите start.command еще раз."
    pause_before_exit
    exit 1
fi

if brew list --formula php >/dev/null 2>&1; then
    echo "PHP уже установлен через Homebrew. Проверяю обновления..."
    brew upgrade php || true
else
    echo "Устанавливаю PHP через Homebrew..."
    brew install php
    mkdir -p "$STATE_DIR"
    touch "$PHP_MARKER"
fi

if command -v php >/dev/null 2>&1; then
    php -v | sed -n '1p'
elif [ -x /opt/homebrew/bin/php ]; then
    /opt/homebrew/bin/php -v | sed -n '1p'
elif [ -x /usr/local/bin/php ]; then
    /usr/local/bin/php -v | sed -n '1p'
fi

echo
echo "PHP готов."
pause_before_exit
