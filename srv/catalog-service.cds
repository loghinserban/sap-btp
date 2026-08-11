using db from '../db/schema';

service CatalogService {
    action seedDemoData(count:Integer) returns String;
    entity Skills as projection on db.Skills;
    entity Departments as projection on db.Departments;
    entity Reviews as projection on db.Reviews;
    
    entity Employees as projection on db.Employees {
        *,
        department
    };
    
    entity EmployeeSkills as projection on db.EmployeeSkills;

    //search

    type SkillHit :{
        skillId: String;
        name : String(100);
        rating : Integer;
        lastUsed: Date;
        months : Integer;
        freshness: String(100);
    };

    type EmployeeMatch:{
        ID: String(100);
        firstName: String(100);
        lastName: String(100);
        fullName:String(100);
        email: String(100);
        departmentID: String(100);
        departmentName: String(100);
        experience: Integer;
        age: Integer;
        score: Integer;
        worstFreshness: String(100);
        matchedSkills : array of SkillHit;
    };

    function searchEmployees(
        skillIds: String(100),
        minRating: Integer,
        maxMonths: Integer,
        departmentID:String(100),
        minAge: Integer,
        maxAge: Integer,
        query: String(100),
    )returns array of EmployeeMatch;


}