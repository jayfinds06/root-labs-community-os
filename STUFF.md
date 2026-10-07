health = round(
  0.175 * clamp(100 + trend(activeUsersWeek, activeUsersPrevWeek), 0, 200) +
  0.125 * clamp(100 + trend(weekMsgCount, prevWeekMsgCount), 0, 200) +
  0.25  * clamp((1 - negRateWeek) * 100, 0, 100) +
  0.15  * clamp(100 - 20 * channelsAtRisk, 0, 100)
)

The main Overview health score comes from getOverviewData() in the backend, not from the UI. It is computed with a weighted composite over a 7-day and 24-hour message window in server/services/dashboard.ts:

It gathers today, yesterday, last 7 days, and previous 7 days messages using queryMessages() (non-empty, non-deleted messages, with sentiment label from messageSentiment, pending when label is null). See server/services/dashboard.ts#L279.
Then it calculates:
activeTrend = pct((activeUsersWeek - activeUsersPreviousWeek) / activeUsersPreviousWeek)
messageTrend = pct((weekMessages.length - previousWeekMessages.length) / previousWeekMessages.length)
sentimentScore = clamp((1 - negativeRateWeek) * 100, 0, 100) where negativeRateWeek = weeklyNegative / weeklyClassified
riskScore = clamp(100 - channelsWithRisk * 20, 0, 100), where channelsWithRisk is count of channels with negativeRate >= 20% or negativeDelta > 10.
Final score is:
healthScore = round(clamp(activeTrend + 100, 0, 200) * 0.175 + clamp(messageTrend + 100, 0, 200) * 0.125 + sentimentScore * 0.25 + riskScore * 0.15)
So range is effectively 0–100.

There is also a separate sentiment-tab metric called healthScore in src/components/admin/SentimentWorkspace.tsx, computed as:

100 - pendingShare*45 - negativeShare*35, clamped to [0,100] (pendingShare = pending/total, negativeShare = negative/total; returns 100 when no messages).


The overview health score is a weighted composite: it starts from four components and sums them with fixed weights, then rounds, specifically health = round(0.175 * clamp(100 + trend(activeUsersWeek, previousActiveUsersWeek),0,200) + 0.125 * clamp(100 + trend(messagesLast7d, previousMessagesLast7d),0,200) + 0.25 * clamp((1 - negativeRateWeek) * 100,0,100) + 0.15 * clamp(100 - 20 * channelsAtRisk, 0, 100)), where trend(current, previous).pct = previous <= 0 ? (current > 0 ? 100 : 0) : ((current - previous)/previous)*100, negativeRateWeek = weeklyNegative / weeklyClassified, and channelsAtRisk is the number of channels in the current top list with negativeRate >= 20% or negativeDelta > 10.