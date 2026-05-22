#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
PORT=8787
PHP_EXE="${PHP_EXE:-}"

pause_before_exit() {
    if [ "${LAMPA_NO_PAUSE:-0}" = "1" ]; then
        return
    fi

    printf '\nНажмите Enter, чтобы закрыть окно...'
    read -r _ || true
}

find_php() {
    if [ -n "$PHP_EXE" ] && [ -x "$PHP_EXE" ]; then
        printf '%s\n' "$PHP_EXE"
        return 0
    fi

    if command -v php >/dev/null 2>&1; then
        command -v php
        return 0
    fi

    for candidate in /opt/homebrew/bin/php /usr/local/bin/php; do
        if [ -x "$candidate" ]; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done

    return 1
}

install_php() {
    echo "PHP не найден или версия ниже 8.1. Запускаю установку PHP через Homebrew..."
    echo
    LAMPA_NO_PAUSE=1 "$SCRIPT_DIR/setup-php.command"
}

PHP_EXE="$(find_php || true)"

if [ -z "$PHP_EXE" ]; then
    install_php || {
        echo
        echo "Не удалось установить PHP."
        pause_before_exit
        exit 1
    }
    PHP_EXE="$(find_php || true)"
fi

if [ -z "$PHP_EXE" ]; then
    echo "PHP 8.1 или новее не найден."
    pause_before_exit
    exit 1
fi

PHP_VERSION_ID="$("$PHP_EXE" -r 'echo PHP_VERSION_ID;' 2>/dev/null || true)"
if [ -z "$PHP_VERSION_ID" ] || [ "$PHP_VERSION_ID" -lt 80100 ]; then
    install_php || {
        echo
        echo "Не удалось обновить PHP до версии 8.1 или новее."
        pause_before_exit
        exit 1
    }
    PHP_EXE="$(find_php || true)"
    PHP_VERSION_ID="$("$PHP_EXE" -r 'echo PHP_VERSION_ID;' 2>/dev/null || true)"
fi

if [ -z "$PHP_EXE" ] || [ -z "$PHP_VERSION_ID" ] || [ "$PHP_VERSION_ID" -lt 80100 ]; then
    echo "PHP 8.1 или новее не найден."
    pause_before_exit
    exit 1
fi

missing_extensions=()
for extension in curl openssl; do
    if ! "$PHP_EXE" -m 2>/dev/null | grep -qi "^${extension}$"; then
        missing_extensions+=("$extension")
    fi
done

echo "Lampa RUTUBE Proxy"
echo "Автор: Eugene Pchelnikov"
echo "Связь в Telegram: https://t.me/eugenemor"
echo
echo "PHP: $("$PHP_EXE" -r 'echo PHP_VERSION;') ($PHP_EXE)"
echo

if [ "${#missing_extensions[@]}" -gt 0 ]; then
    echo "Предупреждение: не найдены расширения PHP: ${missing_extensions[*]}"
    echo "Без них поиск или получение HLS-ссылок может работать некорректно."
    echo
fi

echo "Запускаю сервер..."
echo
echo "URL для подключения в Lampa:"

ips=()
while IFS= read -r ip; do
    ips+=("$ip")
done < <(ifconfig 2>/dev/null | awk '/inet / && $2 !~ /^127\./ { print $2 }' | sort -u)

if [ "${#ips[@]}" -gt 0 ]; then
    for ip in "${ips[@]}"; do
        echo "  http://$ip:$PORT/plugin.php"
    done
else
    echo "  Не удалось найти локальный IP. Проверьте подключение к сети."
fi

echo
echo "Что нужно сделать:"
echo "1. Откройте Lampa."
echo "2. Перейдите в настройки плагинов."
echo "3. Вставьте один из URL выше."
echo
echo "Если адресов несколько, обычно нужен тот, который начинается на 192.168, 10 или 172."
echo
echo "Важно: не закрывайте это окно, пока смотрите видео."
echo "Чтобы остановить сервер, закройте окно или нажмите Ctrl+C."
echo

"$PHP_EXE" -S "0.0.0.0:$PORT" -t "$SERVER_DIR" "$SERVER_DIR/router.php" 2>/dev/null
