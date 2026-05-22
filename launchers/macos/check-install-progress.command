#!/usr/bin/env bash
set -u

pause_before_exit() {
    printf '\nНажмите Enter, чтобы закрыть окно...'
    read -r _ || true
}

updates_size() {
    if [ -d /Library/Updates ]; then
        du -sh /Library/Updates 2>/dev/null | awk '{ print $1 }'
    else
        printf 'нет папки'
    fi
}

print_processes() {
    ps ax -o pid=,etime=,command= \
        | awk '/[s]oftwareupdate|[s]oftwareupdated|[i]nstalld|[m]obileassetd/ { print "  " $0 }'
}

echo "Lampa RUTUBE Proxy"
echo "Монитор установки Homebrew / Xcode Command Line Tools"
echo
echo "Оставьте окно установки открытым. Это окно только показывает признаки активности."
echo "Чтобы остановить монитор, нажмите Ctrl+C."
echo

while true; do
    clear
    echo "Проверка: $(date '+%H:%M:%S')"
    echo
    echo "Процессы установки:"
    processes="$(print_processes)"
    if [ -n "$processes" ]; then
        printf '%s\n' "$processes"
    else
        echo "  Активные процессы softwareupdate не найдены."
    fi

    echo
    echo "Размер /Library/Updates: $(updates_size)"
    echo
    echo "Последние сообщения softwareupdate:"
    log show \
        --style compact \
        --last 2m \
        --predicate 'process == "softwareupdate" OR process == "softwareupdated" OR process == "Software Update" OR process == "mobileassetd" OR process == "installd"' \
        2>/dev/null \
        | tail -n 12 \
        | sed 's/^/  /'

    echo
    echo "Если время у процесса растет, появляются новые строки лога или меняется размер /Library/Updates, установка жива."
    echo "Обновление Xcode Command Line Tools иногда долго висит на одной строке без процентов."
    sleep 10
done

pause_before_exit
