namespace db;
using {cuid, managed} from '@sap/cds/common';

entity Company : cuid, managed{
    Info: Composition of many EmpInfo on Info.emp = $self;
    Role: Boolean;
}

entity Skills: cuid{
    Name : String(100);
    Description: String(255);
}

entity Departments : cuid{
    Name : String(100);
    Description : String(255);
}

entity Review : cuid{
    Title : String(100);
    Content : String(255);
    Stars : Integer;
    emp: Association to EmpInfo;
}

entity EmpSkills : cuid{
    emp : Association to EmpInfo;
    skill: Association to EmpSkills;
}

entity EmpInfo:cuid{
    FirstName: String(100);
    LastName: String(100);
    Age:Integer;
    Experience: Integer;
    emp:Association to Company;
    skill: Composition of many EmpSkills on skill.emp=$self;
    department: Association to Departments;
    Reviews: Composition of many Review on Reviews.emp =$self;
}