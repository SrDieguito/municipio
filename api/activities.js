import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

    try {

        // 🔹 PARSEAR BODY (FIX VERCEL)
        let body = req.body;

        if (typeof body === "string") {
            body = JSON.parse(body);
        }

        // 🔹 GET
        if (req.method === 'GET') {

            const { data, error } = await supabase
                .from('activities')
                .select(`
                    *,
                    users:created_by (id, username),
                    activity_assignments (
                        id,
                        people (id, name, role)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("GET ERROR:", error);
                return res.status(500).json({ success: false, message: error.message });
            }

            return res.json(data);
        }
}
        // 🔹 POST
if (req.method === 'POST') {

    console.log("BODY:", body);

    const { title, start_time, end_time, user_id, people_ids } = body;

    if (!title || !start_time || !end_time || !user_id) {
        return res.status(400).json({ success: false, message: "Datos incompletos" });
    }

    // 🔥 1. CREAR ACTIVIDAD
    const { data: activity, error } = await supabase
        .from('activities')
        .insert([{
            title,
            start_time,
            end_time,
            status: 'pending',
            created_by: user_id
        }])
        .select()
        .single();

    if (error) {
        console.error("POST ERROR:", error);
        return res.status(500).json({ success: false, message: error.message });
    }

    // 🔥 2. INSERTAR PERSONAS (AQUÍ ESTABA EL PROBLEMA)
    if (people_ids && people_ids.length > 0) {

        const assignments = people_ids.map(person_id => ({
            activity_id: activity.id,
            person_id
        }));

        const { error: assignError } = await supabase
            .from('activity_assignments')
            .insert(assignments);

        if (assignError) {
            console.error("ASSIGN ERROR:", assignError);
        }
    }

    return res.json({ success: true, activity });
}
}