import YahooFinance from 'yahoo-finance2';

const yahooFinance: any =
  typeof YahooFinance === 'function'
    ? new (YahooFinance as any)({
        suppressNotices: ['yahooSurvey'],
      })
    : (YahooFinance as any);

export default yahooFinance;
