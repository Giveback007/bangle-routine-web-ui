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
    let editState = $state<null | 'del' | 'edit'>('edit');
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
<div class="p-3 font-medium">
    <div class="flex">
        <button
            class="border p-1 {isConnected ? "bg-green-400" : "bg-orange-300"}"
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
        >{isConnected ? "Disconnect" : "Connect"}</button>

        <div class="min-h-full border mx-3.5"></div>

        <button 
            class:bg-red-400={editState === 'del'}
            class="border p-1 mr-0.5"
            onclick={() => editState = editState === 'del' ? null : 'del'}
        >Del</button>

        <button 
            class:bg-blue-400={editState === 'edit'}
            class="border p-1 mr-0.5"
            onclick={() => editState = editState === 'edit' ? null : 'edit'}
        >Edit</button>

        <div class="min-h-full border mx-3.5"></div>
    
        <button
            disabled={!isConnected}
            class="ml-auto border p-0.5 mr-1 disabled:opacity-50"
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
        >{isReading === 'ERR' ? "ERROR" : isReading === "LOADING" ? 'Loading...' : 'Read State'}</button>
    
        <button
            class="border p-0.5 disabled:opacity-50"
            disabled={!isConnected}
            onclick={async () => {
                const ref: {
                    [x in string]: CheckListItem;
                } = JSON.parse(JSON.stringify(listState!.listItemRef));

                const deleteItem = (id: number) => {
                    if (ref[id].t !== itemType.item) // delete all children first
                        ref[id].c.forEach(id => deleteItem(id))
                    
                    delete ref[id]
                }

                toDelete.forEach(deleteItem);
                
                // clean up every list
                const lists = getAllLists(ref);
                lists.forEach(l => l.c = l.c.filter(id => ref[id]));

                // set changes to svelte state
                listState!.listItemRef = ref;

                // clean up home screen list
                listState!.homeScreen = listState!.homeScreen.filter(id => ref[id]);

                // upload data to watch
                await connection!.espruinoSendFile("routine.state.json", JSON.stringify(listState), {
                    fs: true, // optional: write to SD card
                    chunkSize: 300,
                    progress: (chunkNo, chunkCount) => updatingWatch = chunkNo / chunkCount,
                });

                localStorage.setItem('TEMP', JSON.stringify(listState))
            }}
        >{updatingWatch === 1 ? "Update State" : `Updating: ${Math.round(updatingWatch * 100)}%`}</button>
    </div>

    {#if errorText}
        <div class="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm m-1">
            <p>{errorText}</p>
        </div>
    {/if}

    {#if listState}
        <button
            class="border border-black w-full mt-1 p-1 font-bold"
            onclick={() => {
                const id = genRandId();
                listState!.listItemRef[id] = {n: new Date().toDateString(), c: [], id, t: 1};
                listState!.homeScreen.unshift(id);
            }}
        >+ List</button>
        {#each listState.homeScreen as id (id)}
            {@render genItem(listState.listItemRef[id])}
        {/each}
    {:else}
        NOT LOADED YET
    {/if}

    {#snippet genItem(x: CheckListItem)}
        {#if x.t === itemType.item}
            <div>
                {@render itemButtons(x)}
                <label>
                <input
                    type="checkbox"
                    checked={!!x.d}
                    disabled={false}
                    onchange={(e) => {
                        const status = Number(e.currentTarget.checked) as 1 | 0;
                        (listState!.listItemRef[x.id] as any).d = status
                    }}
                >
                    <!-- {#if editState === 'edit'} -->
                        <input 
                            id="{x.id}-name" 
                            type="text" 
                            bind:value={x.n} 
                            class="p-0 px-1 border-0 border-b border-gray-200 mb-px {x.d ? "text-green-700" : ""}"
                        />
                    <!-- {:else}
                        <span class="{x.d ? "text-green-700" : ""}">{x.n}</span>
                    {/if} -->
                </label>
            </div>
        {:else}
            <div class="mt-1 border p-0.5 mb-1">
                <div class="border-b py-0.5 mb-0.5 border-gray-500  flex">
                    {@render itemButtons(x)}
                    {#if editState === 'edit'}
                        <input type="text" bind:value={x.n} class="p-0 px-1 text-lg font-bold" onchange={(e) => {
                            e.currentTarget.value
                        }} />
                    {:else}
                        {@const stats = calcItemStatus(x.id, ref)}
                        <span class="font-bold text-lg pl-1.5 flex">
                            <button 
                                title="Toggle collapse {x.n}"
                                class="mr-1 cursor-pointer hover:bg-gray-300 rounded-sm"
                                onclick={() => expanded[x.id] = !expanded[x.id]}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-7 pb-0.5 mt-auto">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                </svg>
                            </button>
                            <div class="flex font-mono">
                                <div class="m-auto leading-0 mr-1">{stats.total}/{stats.totalDone}</div>
                            </div> {x.n}:
                        </span>
                    {/if}
                </div>
                <div   
                    class:hidden={!expanded[x.id]}
                    class="ml-5"
                >
                    {#each x.c as subId (subId)}
                        {@render genItem(listState!.listItemRef[subId])}
                    {/each}
                    <div class="flex mb-0.5">
                        <button
                            class="border border-black w-full mr-1.5"
                            onclick={() => {
                                const id = genRandId();
                                listState!.listItemRef[id] = {n: '', d: 0, id, t: 0};
                                x.c.push(id);
                            }}
                        >+ Item</button>
                        <button
                            class="border border-black w-full"
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
        class:bg-red-300={toDelete.has(x.id)}
        class:hidden={editState !== 'del'}
        class="border border-black mr-0.5 rounded-xs w-12"
        onclick={() => toDelete.has(x.id) ? toDelete.delete(x.id) : toDelete.add(x.id)}
    >{toDelete.has(x.id) ? '🗑' : '-'}</button>
    <span class:hidden={editState !== 'edit'} class="my-auto">
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
            class="border border-black px-0.5 rounded-xs"
        >▲</button>
        <button
            class="border border-black px-0.5 rounded-xs"
            onclick={() => {
                const { list, idx } = findListAndIndex(x.id)
                if (list === 'home') {
                    const h = listState!.homeScreen;
                    if (idx < h.length - 1) swapIndexes(h, idx, idx+1)
                } else {
                    if (idx < list.c.length - 1) swapIndexes(list.c, idx, idx+1)
                }
            }}
        >▼</button>
    </span>
{/snippet}