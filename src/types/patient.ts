export interface CreatePatientInput {
  phn: string;
  firstName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  sex?: string;
  phone?: string;
  email?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  insurance?: {
    payerName: string;
    payerId?: string;
    memberId: string;
    groupId?: string;
    subscriberName?: string;
    relationship?: string;
  };
}

export interface PatientSummary {
  id: string;
  phn: string;
  firstName: string;
  lastName: string;
  dob: string;
  sex?: string;
  phone?: string;
  encounterCount: number;
  lastEncounterDate?: Date;
}
