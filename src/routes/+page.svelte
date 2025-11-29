<script lang="ts">
    import { onMount } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { calcItemStatus } from "../utils";

    const genRandId = () => Number((Math.random()+"").split('.')[1]);
    
    function swapIndexes<T>(arr: T[], idxA: number, idxB: number) {
        [arr[idxB], arr[idxA]] = [arr[idxA], arr[idxB]];
    }

    function getAllLists(ref = listState!.listItemRef): {t: 1 | 2; c: number[];}[] {
        const arr = Object.values(ref);
        return arr.filter(x => x.t) as any; // find all lists
    }

    function findListAndIndex(id: number) {
        const lists = getAllLists();
        
        let list: {
            t: 1 | 2;
            c: number[];
        } | 'home' = lists.find(l => l.c.includes(id))! // find the list it belongs to

        let idx: number;

        if (!list) {
            idx = listState!.homeScreen.findIndex(_id => _id === id);
            if (idx !== -1) list = 'home'
        } else {
            idx = list.c.findIndex(_id => _id === id); // find the index
        }

        return {list, idx};
    }
    
    onMount(() => {
        delete UART.ports[1]
        listState = JSON.parse(localStorage.getItem('TEMP') || 'null')
    })
    
    const log = console.log;
    
    let connection: Connection | null = $state(null);
    let isConnected = $state(false);
    let listState: ListState | null = $state(null);
    let toDelete = new SvelteSet<number>();
    let editState = $state<null | 'del' | 'edit'>(null);
    let expanded = $state<{ [K in string]: boolean }>({});
    let updatingWatch = $state(1);
    let isReading: 'ERR' | "LOADING" | "DONE" = $state("DONE");
    let errorText = $state<string | null>(null)

    const ref = $derived(listState as ListState | null ? (listState as any).listItemRef : {})

    const itemType = {
        item: 0,
        routine: 1,
        checklist: 2,
    } as const;
</script>

<div class="p-1 sm:p-2 md:p-2.5 font-medium bg-gray-50 min-h-screen">
    <!-- Header Controls -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-1 sm:p-2 md:p-4 mb-2">
        <div class="flex gap-2 items-center flex-wrap">
            <button
                class="px-3 py-2 rounded-md font-semibold transition-all {isConnected 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-orange-400 hover:bg-orange-500 text-white'}"
                onclick={async () => {
                    if (isConnected) {
                        UART.close();
                        connection = null;
                        isConnected = false
                    } else {
                        connection = await UART.connectAsync();
                        isConnected = true;
                    }
                }}
            >   
                <span class="inline sm:hidden">{isConnected ? "●" : "○"}</span>
                <span class="hidden sm:inline">{isConnected ? "● Connected" : "○ Connect"}</span>
            </button>

            <div class="w-px h-6 bg-gray-300"></div>

            <button 
                class="min-w-12 p-2 rounded-md font-semibold transition-all {editState === 'del'
                    ? 'bg-red-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
                onclick={() => editState = editState === 'del' ? null : 'del'}
            >🗑 <span class="hidden sm:inline">Delete</span></button>

            <button 
                class="min-w-12 p-2 rounded-md font-semibold transition-all {editState === 'edit'
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
                onclick={() => editState = editState === 'edit' ? null : 'edit'}
            >✏️ <span class="hidden sm:inline">Edit</span></button>

            <div class="w-px h-6 bg-gray-300"></div>
        
            <button
                disabled={!isConnected}
                class="ml-auto px-3 py-2 rounded-md font-semibold transition-all bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                onclick={async () => {
                    try {
                        isReading = "LOADING";
                        const fileContents = await connection!.espruinoReceiveFile("routine.state.json", {
                            timeout: 6_000,
                            fs: false,
                            chunkSize: 300,
                            progress: (bytes: number) => {
                                console.log(`Received ${bytes} bytes`);
                            }
                        } as any);
                        isReading = "DONE";

                        listState = JSON.parse(fileContents.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":'));
                        localStorage.setItem('TEMP', JSON.stringify(listState))
                    } catch(err) {
                        if (err instanceof Error) errorText = err.message;
                        isReading = 'ERR'
                    }
                }}
            >
                {#if isReading === 'ERR'}
                    ⚠ <span class="hidden sm:inline">Error</span>
                {:else if isReading === "LOADING"}
                    ⟳ <span class="hidden sm:inline">Loading...</span>
                {:else}
                    <span class="inline-block rotate-180">⬆</span> <span class="hidden sm:inline">Download</span>
                {/if}
            </button>
        
            <button
                class="px-3 py-2 rounded-md font-semibold transition-all bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isConnected}
                onclick={async () => {
                    const ref: {
                        [x in string]: CheckListItem;
                    } = JSON.parse(JSON.stringify(listState!.listItemRef));

                    const deleteItem = (id: number) => {
                        if (!ref[id]) return;

                        if (ref[id].t !== itemType.item)
                            ref[id].c.forEach(id => deleteItem(id))
                        
                        delete ref[id];
                    }

                    toDelete.forEach(deleteItem);
                    
                    const lists = getAllLists(ref);
                    lists.forEach(l => l.c = l.c.filter(id => ref[id]));

                    listState!.listItemRef = ref;
                    listState!.homeScreen = listState!.homeScreen.filter(id => ref[id]);

                    await connection!.espruinoSendFile("routine.state.json", JSON.stringify(listState), {
                        fs: true,
                        chunkSize: 300,
                        progress: (chunkNo, chunkCount) => updatingWatch = chunkNo / chunkCount,
                    });

                    localStorage.setItem('TEMP', JSON.stringify(listState))
                }}
            >
                {#if updatingWatch === 1}
                    ⬆ <span class="hidden sm:inline">Update</span>
                {:else}
                    {Math.round(updatingWatch * 100)}%
                {/if}
            </button>
        </div>

        {#if errorText}
            <div class="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm mt-3 flex items-start gap-3">
                <span class="text-lg">⚠</span>
                <p>{errorText}</p>
            </div>
        {/if}
    </div>

    <!-- Content Area -->
    {#if listState}
        <div class="space-y-0.5 sm:space-x-1.5">
            <button
                class="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-lg p-3 font-bold text-gray-700 hover:text-blue-600 transition-all mb-0.5"
                onclick={() => {
                    const id = genRandId();
                    listState!.listItemRef[id] = {n: new Date().toDateString(), c: [], id, t: 1};
                    listState!.homeScreen.unshift(id);
                }}
            >+ New List</button>

            {#each listState.homeScreen as id (id)}
                {@render genItem(listState.listItemRef[id])}
            {/each}
        </div>
    {:else}
        <div class="text-center py-12">
            <p class="text-gray-500 text-lg">Loading state...</p>
        </div>
    {/if}

    {#snippet genItem(x: CheckListItem)}
        {#if x.t === itemType.item}
            <div class="bg-white rounded-lg border border-gray-200 py-0.5 px-1 pl-3 hover:shadow-sm transition-shadow">
                <label class="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!!x.d}
                        onchange={(e) => {
                            const status = Number(e.currentTarget.checked) as 1 | 0;
                            (listState!.listItemRef[x.id] as any).d = status
                        }}
                        class="w-5 h-5 rounded cursor-pointer accent-green-500"
                    >
                    <div class="flex-1 flex items-center gap-2">
                        {@render itemButtons(x)}
                        <input 
                            id="{x.id}-name" 
                            type="text" 
                            bind:value={x.n} 
                            class="rounded-md flex-1 p-2 bg-transparent border-0 border-b border-gray-200 focus:border-blue-400 focus:outline-none {x.d ? 'text-green-700' : 'text-gray-800'}"
                        />
                    </div>
                </label>
            </div>
        {:else}
            <div class="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div class="border-b border-gray-200 p-3 flex items-center gap-2 bg-gray-50">
                    {@render itemButtons(x)}
                    {#if editState === 'edit'}
                        <input 
                            type="text" 
                            bind:value={x.n} 
                            class="flex-1 p-2 bg-white border border-gray-300 rounded font-bold text-lg focus:outline-none focus:border-blue-400"
                        />
                    {:else}
                        {@const stats = calcItemStatus(x.id, ref)}
                        <button 
                            title="Toggle collapse {x.n}"
                            class="p-1 hover:bg-gray-300 rounded transition-colors shrink-0"
                            onclick={() => expanded[x.id] = !expanded[x.id]}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-5 transition-transform {expanded[x.id] ? 'rotate-180' : ''}">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                        </button>
                        <span class="font-bold text-lg text-gray-800 flex-1">
                            {x.n}
                            <span class="text-sm text-gray-500 font-normal ml-2">({stats.totalDone}/{stats.total})</span>
                        </span>
                    {/if}
                </div>
                <div   
                    class:hidden={!expanded[x.id]}
                    class="p-3 space-y-1 bg-gray-50"
                >
                    {#each x.c as subId (subId)}
                        {@render genItem(listState!.listItemRef[subId])}
                    {/each}
                    <div class="flex gap-2 pt-2">
                        <button
                            class="flex-1 border border-gray-300 bg-white hover:bg-blue-50 rounded-md p-2 font-semibold text-gray-700 hover:text-blue-600 transition-colors"
                            onclick={() => {
                                const id = genRandId();
                                listState!.listItemRef[id] = {n: '', d: 0, id, t: 0};
                                x.c.push(id);
                            }}
                        >+ Item</button>
                        <button
                            class="flex-1 border border-gray-300 bg-white hover:bg-emerald-50 rounded-md p-2 font-semibold text-gray-700 hover:text-emerald-600 transition-colors"
                            onclick={() => {
                                const id = genRandId();
                                listState!.listItemRef[id] = {n: '', c: [], id, t: 1};
                                x.c.push(id);
                            }}
                        >+ List</button>
                    </div>
                </div>
            </div>
        {/if}
    {/snippet}
</div>

{#snippet itemButtons(x: CheckListItem)}
    <button
        class:hidden={editState !== 'del'}
        class="px-2 py-1 rounded transition-all {toDelete.has(x.id)
            ? 'bg-red-500 text-white' 
            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
        onclick={() => toDelete.has(x.id) ? toDelete.delete(x.id) : toDelete.add(x.id)}
    >{toDelete.has(x.id) ? '✓ Delete' : 'Mark'}</button>
    <span class:hidden={editState !== 'edit'} class="flex gap-1">
        <button  
            onclick={() => {
                const { list, idx } = findListAndIndex(x.id)
                if (list === 'home') {
                    const h = listState!.homeScreen;
                    if (idx > 0) swapIndexes(h, idx, idx-1)
                } else {
                    if (idx > 0) swapIndexes(list.c, idx, idx-1)
                }
            }}
            class="p-1 border border-gray-300 bg-white hover:bg-gray-100 rounded transition-colors"
            title="Move up"
        >▲</button>
        <button
            class="p-1 border border-gray-300 bg-white hover:bg-gray-100 rounded transition-colors"
            onclick={() => {
                const { list, idx } = findListAndIndex(x.id)
                if (list === 'home') {
                    const h = listState!.homeScreen;
                    if (idx < h.length - 1) swapIndexes(h, idx, idx+1)
                } else {
                    if (idx < list.c.length - 1) swapIndexes(list.c, idx, idx+1)
                }
            }}
            title="Move down"
        >▼</button>
    </span>
{/snippet}