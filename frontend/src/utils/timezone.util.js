import { formatInTimeZone } from 'date-fns-tz';

const UAE_TIMEZONE = 'Asia/Dubai';

export const formatToUAETime = (date) => {
  if (!date) return '-';
  return formatInTimeZone(new Date(date), UAE_TIMEZONE, 'MMM dd, yyyy HH:mm');
};

export const getElapsedTimeInUAE = (date) => {
  if (!date) return { hours: 0, minutes: 0, seconds: 0 };

  const nowInUAE = formatInTimeZone(new Date(), UAE_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const creationTimeInUAE = date;
  const nowDate = new Date(nowInUAE);
  const creationDate = new Date(creationTimeInUAE);
  const diffInSeconds = Math.floor((nowDate - creationDate) / 1000);
  
  return {
    hours: Math.floor(diffInSeconds / 3600),
    minutes: Math.floor((diffInSeconds % 3600) / 60),
    seconds: diffInSeconds % 60
  };
};