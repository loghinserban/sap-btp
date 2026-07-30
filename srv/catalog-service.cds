using db from '../db/schema';

service AppService {
    entity Company as projection on db.Company;
    entity Skills as projection on db.Skills;
    entity Departments as projection on db.Departments;
    entity Review as projection on db.Review;
    entity EmpSkills as projection on db.EmpSkills;
    entity EmpInfo as projection on db.EmpInfo;
}