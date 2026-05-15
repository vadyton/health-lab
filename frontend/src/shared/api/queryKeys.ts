export const qk = {
  activities: {
    all:     ()                          => ["activities"] as const,
    summary: ()                          => ["activities", "summary"] as const,
    list:    ()                          => ["activities", "list"] as const,
    detail:  (id: string)                => ["activities", "detail", id] as const,
  },
  sleep: {
    all:     ()                          => ["sleep"] as const,
    summary: ()                          => ["sleep", "summary"] as const,
    detail:  (id: string)                => ["sleep", "detail", id] as const,
  },
  heartRate: {
    all:  ()                             => ["heartRate"] as const,
    data: (date: string, range: string)  => ["heartRate", date, range] as const,
  },
  steps: {
    all:  ()                             => ["steps"] as const,
    data: (date: string, range: string)  => ["steps", date, range] as const,
  },
  spo2: {
    data: (date: string, range: string)  => ["spo2", date, range] as const,
  },
  profile: {
    data: ()                             => ["profile"] as const,
  },
  body: {
    all:  ()                             => ["body"] as const,
    data: (date: string, range: string)  => ["body", date, range] as const,
  },
} as const;
