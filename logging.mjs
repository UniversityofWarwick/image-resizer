import winston from 'winston';

export default winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format((info) => {
      info.type = info.type || 'application';
      return info;
    })(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});
