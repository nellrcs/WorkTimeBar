export function itemTable(data,setCheckActive,removeArray){
    let tr = document.createElement('tr');
    tr.classList.add('border-b','border-gray-700','hover:bg-gray-600','bg-gray-800');
    tr.innerHTML = ( `
                  <td class="w-4 p-4">
                    <div class="flex items-center">
                      <input type="checkbox" data-check='${data.index}' class="h-4 w-4 rounded focus:ring-2 border-gray-600 bg-gray-700 ring-offset-gray-800 focus:ring-blue-600 focus:ring-offset-gray-800" ${data.active ? ' checked' : '' }/>
                    </div>
                  </td>
                  <th scope="row" class="whitespace-nowrap px-6 py-4 font-medium text-white">${data.title}</th>
            <td class="px-6 py-4">
                   <div class="mx-0 h-5 w-full rounded bg-gray-700">
                      <div class="h-5 rounded bg-green-500" style="width: ${data.tempo}%"></div>
                    </div>
                  </td>
                  <td class="px-6 py-4 "> <span class="text-blue-500"> ${data.sPlay}</span>/  <span class="text-gray-300">${data.sPause}</span> </td>
                  <td class="px-6 py-4">
                  </button>
                  
                    <button type="button" data-remove='${data.index}' class="clickRemove text-white focus:outline-none font-medium  text-sm p-2.5 text-center inline-flex items-center hover:text-red-500">

                    <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 7h14m-9 3v8m4-8v8M10 3h4a1 1 0 0 1 1 1v3H9V4a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z"/>
                    </svg>                    
                              
                    <span class="sr-only">Excluir</span>
                  </button>
                  </td>

`).trim();

    tr.querySelector("[data-remove='"+data.index+"']").addEventListener('click',function () {
    removeArray(data.index)
    });

    tr.querySelector("[data-check='"+data.index+"']").addEventListener('click',function () {
    setCheckActive(data.index)
    });
    return tr;
}