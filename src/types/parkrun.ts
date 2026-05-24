export interface RunRecord {
  date: string;           // YYYY-MM-DD
  eventName: string;
  eventSlug: string;
  time: string;           // HH:MM:SS
  position: number;
  genderPosition: number;
  ageGrade: number;       // percentage, e.g. 59.29
  isPB: boolean;
  runNumber: number;      // cumulative run number for this athlete
}

export interface EventSummaryEntry {
  eventName: string;
  eventSlug: string;
  runCount: number;
  bestTime: string;
  firstRunDate: string;
}

export interface AthleteHistory {
  athleteId: string;
  name: string;
  totalRuns: number;
  runs: RunRecord[];
  eventSummary: EventSummaryEntry[];
}

export interface Finisher {
  position: number;
  name: string;
  athleteId: string;
  totalFinishes: number;
  gender: string;
  genderPosition: number;
  milestones: string[];   // e.g. ['100', 'v25']
  ageGroup: string;       // e.g. 'VM55-59'
  ageGrade: number;
  club: string;
  time: string;
  pbStatus: string;       // 'New PB!', 'PB HH:MM:SS', or ''
  isFirstTimer: boolean;
}

export interface Volunteer {
  name: string;
  athleteId: string;
  role: string;
}

export interface EventResults {
  eventName: string;
  eventSlug: string;
  date: string;
  eventNumber: number;
  finisherCount: number;
  volunteerCount: number;
  finishers: Finisher[];
  volunteers: Volunteer[];
}

export interface EventHistoryEntry {
  date: string;
  eventNumber: number;
  finisherCount: number;
  firstFinisherName: string;
  firstFinisherTime: string;
}

export interface VolunteerRosterDate {
  date: string;
  roles: Array<{ role: string; name: string }>;
}
