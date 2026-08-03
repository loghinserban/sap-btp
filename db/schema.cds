namespace db;
using {cuid, managed} from '@sap/cds/common';

entity Skills: cuid{
    name : String(100);
    description: String(255);
}

entity Departments : cuid{
    name : String(100);
    description : String(255);
}

entity Reviews : cuid{
    title : String(100);
    content : String(255);
    stars : Integer;
    employee: Association to Employees;
}

entity EmployeeSkills : cuid{
    employee : Association to Employees;
    skill: Association to Skills;
}

entity Employees:cuid{
    firstName: String(100);
    lastName: String(100);
    age:Integer;
    experience: Integer;

    skills: Composition of many EmployeeSkills on skills.employee=$self;
    department: Association to Departments;
    reviews: Composition of many Reviews on reviews.employee =$self;
}