using db from '../db/schema';

service CatalogService {
    entity Skills as projection on db.Skills;
    entity Departments as projection on db.Departments;
    entity Reviews as projection on db.Reviews;
    
    entity Employees as projection on db.Employees {
        *,
        department
    };
    
    entity EmployeeSkills as projection on db.EmployeeSkills;
}