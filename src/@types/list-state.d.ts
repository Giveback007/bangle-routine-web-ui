type ID = number;

type ListState = {
    ver: number;
    screen: 'home' | ID;
    navHistory: ('home' | ID)[];
    homeScreen: ID[];
    listItemRef: { [K in string]: CheckListItem; };
}

type CheckListItem = {
    /** Name */
    n: string;
    /** ID */
    id: ID;
    /** Last modified, the undefined the object hasn't been modified */
    m?: number;
} & ({
    /** 0 === "item" */
    t: 0; // TYPE
    /** Not-Done = 0, Done = 1 */
    d: 0 | 1;
} | {
    /** 1 = "routine" | 2 = "checklist" */
    t: 1 | 2; // TYPE
    /** Child ids */
    c: ID[];
});