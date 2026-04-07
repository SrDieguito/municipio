import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {

    // 🔹 GET - LISTAR ACTIVIDADES CON RELACIONES
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
            return res.status(500).json({ success: false, error });
        }

        return res.json(data);
    }

    // 🔹 POST - CREAR ACTIVIDAD
    if (req.method === 'POST') {

        const { title, start_time, end_time, user_id, people_ids } = req.body;

        if (!title || !start_time || !end_time || !user_id) {
            return res.status(400).json({ success: false });
        }

        // 1. Crear actividad
        const { data: activity, error: errorActivity } = await supabase
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

        if (errorActivity) {
            return res.status(500).json({ success: false, error: errorActivity });
        }

        // 2. Asignar personas (si vienen)
        if (people_ids && people_ids.length > 0) {

            const assignments = people_ids.map(person_id => ({
                activity_id: activity.id,
                person_id
            }));

            await supabase
                .from('activity_assignments')
                .insert(assignments);
        }

        return res.json({ success: true, activity });
    }

    // 🔹 DELETE
    if (req.method === 'DELETE') {

        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false });
        }

        // borrar relaciones primero (buena práctica)
        await supabase
            .from('activity_assignments')
            .delete()
            .eq('activity_id', id);

        await supabase
            .from('activity_logs')
            .delete()
            .eq('activity_id', id);

        await supabase
            .from('activity_history')
            .delete()
            .eq('activity_id', id);

        // borrar actividad
        const { error } = await supabase
            .from('activities')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(500).json({ success: false, error });
        }

        return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}