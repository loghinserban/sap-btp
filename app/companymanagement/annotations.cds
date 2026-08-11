using CatalogService as service from '../../srv/catalog-service';

annotate service.Employees with {
    ID          @Common.Label: 'Employee ID'         @UI.Hidden;
    firstName   @Common.Label: 'First Name';
    lastName    @Common.Label: 'Last Name';
    email       @Common.Label: 'Email';
    dateOfBirth @Common.Label: 'Date of Birth';
    experience  @Common.Label: 'Experience (years)';
    department  @Common.Label            : 'Department'
                @Common.Text             : department.name
                @Common.TextArrangement  : #TextOnly
                @Common.ValueList        : {
        CollectionPath: 'Departments',
        Label         : 'Departments',
        Parameters    : [
            {
                $Type            : 'Common.ValueListParameterInOut',
                LocalDataProperty: department_ID,
                ValueListProperty: 'ID'
            },
            {
                $Type            : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty: 'name'
            },
            {
                $Type            : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty: 'description'
            }
        ]
    };
}

annotate service.Employees with @(UI: {
    HeaderInfo     : {
        TypeName      : 'Employee',
        TypeNamePlural: 'Employees',
        Title         : {Value: firstName},
        Description   : {Value: email}
    },
    SelectionFields: [
        firstName,
        lastName,
        email,
        department_ID,
        experience
    ],
    LineItem       : [
        {Value: firstName},
        {Value: lastName},
        {Value: email},
        {
            Value: department.name,
            Label: 'Department'
        },
        {Value: experience},
        {Value: dateOfBirth}
    ]
});

annotate service.Departments with {
    ID          @Common.Label: 'Department ID' @UI.Hidden;
    name        @Common.Label: 'Name';
    description @Common.Label: 'Description';
}

annotate service.Skills with {
    ID          @Common.Label: 'Skill ID' @UI.Hidden;
    name        @Common.Label: 'Skill';
    description @Common.Label: 'Description';
}

annotate service.Reviews with {
    ID      @Common.Label: 'Review ID' @UI.Hidden;
    title   @Common.Label: 'Title';
    content @Common.Label: 'Content';
    stars   @Common.Label: 'Rating';
}
