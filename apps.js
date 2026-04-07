import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


async function login() {
    let username = document.getElementById("user").value;
    let password = document.getElementById("pass").value;

    let { data } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password);

    if (data.length > 0) {
        window.location.href = "dashboard.html";
    } else {
        alert("Credenciales incorrectas");
    }
}

async function createActivity() {
    let title = document.getElementById("title").value;
    let start = document.getElementById("start").value;
    let end = document.getElementById("end").value;

    await supabase.from('activities').insert([
        { title, start_time: start, end_time: end }
    ]);

    loadActivities();
}

async function loadActivities() {
    let { data } = await supabase.from('activities').select('*');

    let container = document.getElementById("activities");
    container.innerHTML = "";

    data.forEach(act => {

        let statusColor = "bg-gray-700";

        if (act.status === "completed") statusColor = "bg-green-500";
        if (act.status === "in_progress") statusColor = "bg-blue-500";

        container.innerHTML += `
        <div class="bg-gray-900 p-5 rounded-2xl border border-gray-800 hover:scale-105 transition">

            <div class="flex justify-between items-center">
                <h3 class="text-lg font-semibold">${act.title}</h3>
                <span class="text-xs px-2 py-1 rounded ${statusColor}">
                    ${act.status}
                </span>
            </div>

            <p class="text-gray-400 text-sm mt-2">
                Inicio: ${act.start_time || '---'}
            </p>

            <p class="text-gray-400 text-sm">
                Fin: ${act.end_time || '---'}
            </p>

            <button onclick="completeActivity('${act.id}')"
                class="mt-4 bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-sm">
                Completar
            </button>

        </div>
        `;
    });
}

async function completeActivity(id) {
    await supabase
        .from('activities')
        .update({ status: 'completed' })
        .eq('id', id);

    await supabase.from('activity_history').insert([
        { activity_id: id }
    ]);

    loadActivities();
}

loadActivities();