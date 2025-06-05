const UAE_TIMEZONE = 'Asia/Dubai';
const UAE_TIMEZONE_OFFSET = 4; // UTC+4

module.exports = {
  UAE_TIMEZONE,
  UAE_TIMEZONE_OFFSET,
  convertToUAETime: (date) => {
    if (!date) return null;
    return new Date(date.getTime() + (UAE_TIMEZONE_OFFSET * 60 * 60 * 1000));
  },
  convertFromUAETime: (date) => {
    if (!date) return null;
    return new Date(date.getTime() - (UAE_TIMEZONE_OFFSET * 60 * 60 * 1000));
  }
}; 