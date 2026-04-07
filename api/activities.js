import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

    try {

        // ✅ PARSEAR BODY PRIMERO (IMPORTANTE)
        let body = req.body;

        if (typeof body === "string") {
            body = JSON.parse(body);
        }

        // 🔹 GET ACTIVIDADES
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

        // 🔹 POST
        if (req.method === 'POST') {

            console.log("BODY:", body);

            const { title, description, start_time, end_time, user_id, people_names } = body;

            if (!title || !start_time || !end_time || !user_id) {
                return res.status(400).json({ success: false, message: "Datos incompletos" });
            }

            // ✅ 1. CREAR ACTIVIDAD
            const { data: activity, error } = await supabase
                .from('activities')
                .insert([{
                    title,
                    description,
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

            // ✅ 2. PERSONAS
            if (people_names && Array.isArray(people_names) && people_names.length > 0) {

                let person_ids = [];

                for (let name of people_names) {

                    // 🔍 Buscar existente
                    const { data: existing } = await supabase
                        .from('people')
                        .select('*')
                        .ilike('name', name)
                        .maybeSingle();

                    if (existing) {
                        person_ids.push(existing.id);
                    } else {
                        // ➕ Crear
                        const { data: newPerson, error } = await supabase
                            .from('people')
                            .insert([{ name }])
                            .select()
                            .single();

                        if (error) {
                            console.error("PERSON CREATE ERROR:", error);
                            continue;
                        }

                        person_ids.push(newPerson.id);
                    }
                }

                // 🔗 Asignaciones
                const assignments = person_ids.map(person_id => ({
                    activity_id: activity.id,
                    person_id
                }));

                const { error: assignError } = await supabase
                    .from('activity_assignments')
                    .insert(assignments);

                if (assignError) {
                    console.error("ASSIGN ERROR:", assignError);
                    return res.status(500).json({
                        success: false,
                        message: assignError.message
                    });
                }
            }

            return res.json({ success: true, activity });
        }

        // 🔹 DELETE
        if (req.method === 'DELETE') {

            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ success: false });
            }

            await supabase.from('activity_assignments').delete().eq('activity_id', id);
            await supabase.from('activity_logs').delete().eq('activity_id', id);
            await supabase.from('activity_history').delete().eq('activity_id', id);

            const { error } = await supabase
                .from('activities')
                .delete()
                .eq('id', id);

            if (error) {
                console.error("DELETE ERROR:", error);
                return res.status(500).json({ success: false, message: error.message });
            }

            return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error("SERVER ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}