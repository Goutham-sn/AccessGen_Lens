// One number for how many times a person can send the runner to a site in a
// day: the daily cap on runs, and on pre-checks (each is a visit to the site).
export const DAILY_RUN_LIMIT = parseInt(process.env.RUNNER_DAILY_LIMIT || '20', 10)
