/** Sample data: households and individual members. Pure data, no database access, so it is easy to test. */

type SampleMemberStatus = "VISITOR" | "REGULAR" | "MEMBER" | "INACTIVE";

export interface SampleMember {
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE" | "UNSPECIFIED";
  civilStatus?: "SINGLE" | "MARRIED" | "WIDOWED" | "SEPARATED";
  birthDate?: string;
  email?: string;
  phone?: string;
  occupation?: string;
  status: SampleMemberStatus;
  membershipDate?: string;
  baptismDate?: string;
  householdRole?: "HEAD" | "SPOUSE" | "CHILD" | "OTHER";
}

export interface SampleHousehold {
  name: string;
  branchCode: string;
  address: string;
  phone: string;
  members: SampleMember[];
}

export const SAMPLE_HOUSEHOLDS: SampleHousehold[] = [
  {
    name: "Santos Family",
    branchCode: "MAIN",
    address: "12 Mabini Street, Springfield",
    phone: "+1 555 1101",
    members: [
      { firstName: "Roberto", lastName: "Santos", gender: "MALE", civilStatus: "MARRIED", birthDate: "1978-03-14", email: "roberto.santos@cms.local", occupation: "Engineer", status: "MEMBER", membershipDate: "2012-06-10", baptismDate: "2011-12-25", householdRole: "HEAD" },
      { firstName: "Elena", lastName: "Santos", gender: "FEMALE", civilStatus: "MARRIED", birthDate: "1981-08-22", email: "elena.santos@cms.local", occupation: "Teacher", status: "MEMBER", membershipDate: "2012-06-10", baptismDate: "2011-12-25", householdRole: "SPOUSE" },
      { firstName: "Joshua", lastName: "Santos", gender: "MALE", civilStatus: "SINGLE", birthDate: "2008-01-30", status: "REGULAR", householdRole: "CHILD" },
      { firstName: "Hannah", lastName: "Santos", gender: "FEMALE", civilStatus: "SINGLE", birthDate: "2012-11-05", status: "REGULAR", householdRole: "CHILD" },
      { firstName: "Miguel", lastName: "Santos", gender: "MALE", civilStatus: "SINGLE", birthDate: "2019-05-18", status: "REGULAR", householdRole: "CHILD" },
    ],
  },
  {
    name: "Okafor Family",
    branchCode: "MAIN",
    address: "48 Cedar Lane, Springfield",
    phone: "+1 555 1102",
    members: [
      { firstName: "Emeka", lastName: "Okafor", gender: "MALE", civilStatus: "MARRIED", birthDate: "1975-05-02", email: "emeka.okafor@cms.local", occupation: "Physician", status: "MEMBER", membershipDate: "2015-02-15", baptismDate: "2014-08-03", householdRole: "HEAD" },
      { firstName: "Ngozi", lastName: "Okafor", gender: "FEMALE", civilStatus: "MARRIED", birthDate: "1979-09-19", email: "ngozi.okafor@cms.local", occupation: "Accountant", status: "MEMBER", membershipDate: "2015-02-15", householdRole: "SPOUSE" },
      { firstName: "Chidi", lastName: "Okafor", gender: "MALE", civilStatus: "SINGLE", birthDate: "2010-04-12", status: "REGULAR", householdRole: "CHILD" },
      { firstName: "Ada", lastName: "Okafor", gender: "FEMALE", civilStatus: "SINGLE", birthDate: "2018-09-02", status: "REGULAR", householdRole: "CHILD" },
    ],
  },
  {
    name: "Turner Household",
    branchCode: "NORTH",
    address: "7 Pine Ridge, Springfield North",
    phone: "+1 555 1201",
    members: [
      { firstName: "Margaret", lastName: "Turner", gender: "FEMALE", civilStatus: "WIDOWED", birthDate: "1952-12-01", phone: "+1 555 1202", status: "MEMBER", membershipDate: "1990-01-07", baptismDate: "1970-04-12", householdRole: "HEAD" },
      { firstName: "Liam", lastName: "Turner", gender: "MALE", civilStatus: "SINGLE", birthDate: "1996-07-15", email: "liam.turner@cms.local", occupation: "Nurse", status: "REGULAR", householdRole: "OTHER" },
    ],
  },
  {
    name: "Nguyen Family",
    branchCode: "NORTH",
    address: "33 Lakeview Drive, Springfield North",
    phone: "+1 555 1203",
    members: [
      { firstName: "Minh", lastName: "Nguyen", gender: "MALE", civilStatus: "MARRIED", birthDate: "1985-02-27", email: "minh.nguyen@cms.local", occupation: "Software Developer", status: "VISITOR", householdRole: "HEAD" },
      { firstName: "Lan", lastName: "Nguyen", gender: "FEMALE", civilStatus: "MARRIED", birthDate: "1987-10-09", email: "lan.nguyen@cms.local", status: "VISITOR", householdRole: "SPOUSE" },
      { firstName: "Anh", lastName: "Nguyen", gender: "FEMALE", civilStatus: "SINGLE", birthDate: "2016-06-21", status: "VISITOR", householdRole: "CHILD" },
    ],
  },
  {
    name: "Ramirez Family",
    branchCode: "SOUTH",
    address: "90 Riverside Drive, Springfield South",
    phone: "+1 555 1301",
    members: [
      { firstName: "Carlos", lastName: "Ramirez", gender: "MALE", civilStatus: "MARRIED", birthDate: "1970-11-11", email: "carlos.ramirez@cms.local", occupation: "Contractor", status: "MEMBER", membershipDate: "2005-09-18", baptismDate: "2004-12-24", householdRole: "HEAD" },
      { firstName: "Sofia", lastName: "Ramirez", gender: "FEMALE", civilStatus: "MARRIED", birthDate: "1973-01-25", email: "sofia.ramirez@cms.local", status: "MEMBER", membershipDate: "2005-09-18", householdRole: "SPOUSE" },
      { firstName: "Mateo", lastName: "Ramirez", gender: "MALE", civilStatus: "SINGLE", birthDate: "2001-03-03", email: "mateo.ramirez@cms.local", occupation: "Student", status: "INACTIVE", householdRole: "CHILD" },
    ],
  },
];

export const SAMPLE_INDIVIDUALS: (SampleMember & { branchCode: string })[] = [
  { firstName: "Grace", lastName: "Park", gender: "FEMALE", civilStatus: "SINGLE", birthDate: "1994-04-04", email: "grace.park@cms.local", occupation: "Designer", status: "MEMBER", membershipDate: "2020-10-11", baptismDate: "2019-04-21", branchCode: "MAIN" },
  { firstName: "David", lastName: "Mensah", gender: "MALE", civilStatus: "SINGLE", birthDate: "1999-09-09", email: "david.mensah@cms.local", occupation: "Student", status: "VISITOR", branchCode: "MAIN" },
  { firstName: "Isabel", lastName: "Cruz", gender: "FEMALE", civilStatus: "SEPARATED", birthDate: "1983-06-30", phone: "+1 555 1401", status: "REGULAR", branchCode: "MAIN" },
  { firstName: "Tomas", lastName: "Silva", gender: "MALE", civilStatus: "SINGLE", birthDate: "1991-12-12", email: "tomas.silva@cms.local", occupation: "Chef", status: "INACTIVE", branchCode: "NORTH" },
  { firstName: "Aisha", lastName: "Bello", gender: "FEMALE", civilStatus: "SINGLE", birthDate: "2000-02-14", email: "aisha.bello@cms.local", status: "VISITOR", branchCode: "SOUTH" },
  { firstName: "Noah", lastName: "Fischer", gender: "MALE", civilStatus: "MARRIED", birthDate: "1988-08-08", email: "noah.fischer@cms.local", occupation: "Banker", status: "REGULAR", branchCode: "SOUTH" },
];
