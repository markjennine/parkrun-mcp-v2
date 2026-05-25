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
  isJunior: boolean;      // true for junior parkrun events (slug contains "juniors")
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

export interface VolunteerRoleSummary {
  role: string;
  occasions: number;
}

export interface AthleteVolunteerSummary {
  athleteId: string;
  name: string;
  totalCredits: number;
  roles: VolunteerRoleSummary[];
}

export interface ParkrunEvent {
  id: number;
  eventSlug: string;
  longName: string;
  shortName: string;
  location: string;
  latitude: number;
  longitude: number;
  countryCode: number;
  isJunior: boolean;
}

export interface PacingRecord {
  date: string;        // YYYY-MM-DD
  eventName: string;
  eventSlug: string;
  runTime: string;     // athlete's recorded finish time
  position: number;
  pacerRole: string;   // e.g. "Pacer 25:00"
}

export interface ClubResult {
  position: number;
  genderPosition: number;
  name: string;
  athleteId: string;
  club: string;
  time: string;
}

export interface ClubEventGroup {
  eventName: string;
  results: ClubResult[];
}

export interface ClubConsolidatedResults {
  clubNum: string;
  date: string;
  eventGroups: ClubEventGroup[];
  totalRunners: number;
}

export interface ClubMember {
  name: string;
  athleteId: string;
  runsAtEvent: number;
  totalRuns: number;
  milestoneClub: string;
}

export interface ClubMembersSummary {
  clubName: string;
  eventSlug: string;
  totalMembers: number;
  totalRunsAtEvent: number;
  totalRunsOverall: number;
  members: ClubMember[];
}
