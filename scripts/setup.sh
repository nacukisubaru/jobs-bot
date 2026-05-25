# setup.sh — запускать один раз на новом сервере
#!/bin/bash
set -e

echo "📦 Настройка Docker build cache лимита..."
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "builder": {
    "gc": {
      "enabled": true,
      "defaultKeepStorage": "100MB"
    }
  }
}
EOF
systemctl restart docker

echo "📝 Настройка системных логов..."
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/size.conf << 'EOF'
[Journal]
SystemMaxUse=50M
MaxRetentionSec=7day
EOF
systemctl restart systemd-journald

cat > /etc/logrotate.d/rsyslog << 'EOF'
/var/log/syslog
/var/log/auth.log
/var/log/kern.log
{
    rotate 1
    daily
    size 10M
    missingok
    notifempty
    compress
    delaycompress
}
EOF

echo "⏰ Настройка crontab..."
(crontab -l 2>/dev/null; echo "0 3 * * * docker builder prune -a -f && journalctl --vacuum-size=50M") | crontab -

echo "✅ Готово! Теперь запускайте: docker-compose build --no-cache && docker builder prune -a -f && docker-compose up -d"