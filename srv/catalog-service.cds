using db from '../db/schema';

service CatalogService {
    action   extractCv(fileName: String, contentBase64: LargeString)            returns CvProfile;
    action   createEmployeeFromCv(profile: CvProfile, departmentID: String(36)) returns String;

    // Self-service CV import (userview): extract skills only, then apply the ones
    // the user confirmed to their own profile.
    action   extractCvSkills(fileName: String, contentBase64: LargeString)      returns array of CvSkill;
    action   applyCvSkills(employeeID: String(36), skills: array of CvSkill)    returns CvSkillsImport;

    action   seedDemoData(count: Integer)                                       returns String;
    action   reassignDepartment(fromID: UUID, toID: UUID)                       returns String; // daca as muta 30 de angajati din UI as face 30 de request uri.
    entity Skills         as projection on db.Skills;
    entity Departments    as projection on db.Departments;
    entity Reviews        as projection on db.Reviews;

    entity Employees      as
        projection on db.Employees {
            *,
            department
        };

    entity EmployeeSkills as projection on db.EmployeeSkills;

    //search

    type SkillHit      : {
        skillId   : String;
        name      : String(100);
        rating    : Integer;
        lastUsed  : Date;
        months    : Integer;
        freshness : String(100);
    };

    type CvSkill       : {
        skillID  : String(36);
        name     : String(100);
        rating   : Integer;
        lastUsed : Date;
        evidence : String(255);
    };

    type CvSkillsImport : {
        added        : Integer; // new EmployeeSkills rows
        updated      : Integer; // existing rows re-rated
        createdSkills: Integer; // skills added to the shared catalog
        message      : String(255);
    };

    type CvProfile     : {
        firstName  : String(100);
        lastName   : String(100);
        email      : String(100);
        experience : Integer;
        skills     : array of CvSkill;
    };

    type EmployeeMatch : {
        ID             : String(100);
        firstName      : String(100);
        lastName       : String(100);
        fullName       : String(100);
        email          : String(100);
        departmentID   : String(100);
        departmentName : String(100);
        experience     : Integer;
        age            : Integer;
        score          : Integer;
        worstFreshness : String(100);
        matchedSkills  : array of SkillHit;
    };

    function searchEmployees(skillIds: String(100),
                             minRating: Integer,
                             maxMonths: Integer,
                             departmentID: String(100),
                             minAge: Integer,
                             maxAge: Integer,
                             query: String(100), )                              returns array of EmployeeMatch;


}
