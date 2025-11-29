export function calcItemStatus(id: number, ref: ListState['listItemRef']) {
    const itm = ref[id];
    if (itm.t === 0) return { totalDone: itm.d, total: 1, isDone: itm.d === 1 };
    
    let total = 0;
    let done = 0;
    itm.c.forEach(x => {
        total++;
        const status = calcItemStatus(x, ref);
        if (status.isDone) done++;
    });

    return { totalDone: done, total, isDone: done === total };
}