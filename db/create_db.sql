-- Drop table

-- DROP TABLE public.files;

CREATE TABLE public.files (
	id bigserial NOT NULL,
	file_name text NOT NULL,
	file_path text NOT NULL,
	repo_id int8 NOT NULL,
	CONSTRAINT files_pkey PRIMARY KEY (id),
	CONSTRAINT files_fk FOREIGN KEY (repo_id) REFERENCES repos(id)
);
CREATE UNIQUE INDEX files_file_path_repo_id ON public.files USING btree (repo_id, file_path);

-- Drop table

-- DROP TABLE public.intents;

CREATE TABLE public.intents (
	id bigserial NOT NULL,
	intent_name text NOT NULL,
	CONSTRAINT intents_pkey PRIMARY KEY (id)
);

-- Drop table

-- DROP TABLE public.languages;

CREATE TABLE public.languages (
	id serial NOT NULL,
	language_name text NOT NULL,
	CONSTRAINT languages_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX languages_language_name_idx ON public.languages USING btree (lower(language_name));

-- Drop table

-- DROP TABLE public.repos;

CREATE TABLE public.repos (
	id bigserial NOT NULL,
	repo_name text NOT NULL,
	repo_url text NOT NULL,
	CONSTRAINT repos_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX repos_repo_url_idx ON public.repos USING btree (lower(repo_url));

-- Drop table

-- DROP TABLE public.tags;

CREATE TABLE public.tags (
	id bigserial NOT NULL,
	tag_name text NOT NULL,
	CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX tags_tag_name_idx ON public.tags USING btree (lower(tag_name));

-- Drop table

-- DROP TABLE public.entities;

CREATE TABLE public.entities (
	id bigserial NOT NULL,
	entity_type type_entity_type NOT NULL,
	entity_name text NOT NULL,
	entity_comment text NULL,
	line_number int4 NOT NULL,
	file_id int8 NOT NULL,
	raw_data jsonb NOT NULL,
	CONSTRAINT entities_pkey PRIMARY KEY (id),
	CONSTRAINT entities_fk FOREIGN KEY (file_id) REFERENCES files(id)
);

-- Drop table

-- DROP TABLE public.entities_intents;

CREATE TABLE public.entities_intents (
	entity_id int8 NOT NULL,
	intent_id int8 NOT NULL
);
CREATE UNIQUE INDEX entities_intents_entity_id_idx ON public.entities_intents USING btree (entity_id, intent_id);

-- Drop table

-- DROP TABLE public.entities_tags;

CREATE TABLE public.entities_tags (
	entity_id int8 NOT NULL,
	tag_id int8 NOT NULL,
	CONSTRAINT entities_tags_fk FOREIGN KEY (entity_id) REFERENCES entities(id),
	CONSTRAINT entities_tags_fk_1 FOREIGN KEY (tag_id) REFERENCES tags(id)
);
CREATE UNIQUE INDEX entities_tags_entity_id_idx ON public.entities_tags USING btree (entity_id, tag_id);

-- Drop table

-- DROP TABLE public.files_languages;

CREATE TABLE public.files_languages (
	language_id int8 NOT NULL,
	file_id int8 NOT NULL,
	CONSTRAINT files_languages_pk PRIMARY KEY (language_id, file_id),
	CONSTRAINT files_languages_fk FOREIGN KEY (file_id) REFERENCES files(id),
	CONSTRAINT files_languages_fk_1 FOREIGN KEY (language_id) REFERENCES languages(id)
);


CREATE OR REPLACE FUNCTION public.fn_search(search_term text)
 RETURNS TABLE(filename text, repname text, comment text, line integer, type text, score bigint)
 LANGUAGE plpgsql
AS $function$
	BEGIN
		DROP TABLE IF EXISTS _temp_search_terms;
		CREATE TEMP TABLE _temp_search_terms AS 
		SELECT regexp_split_to_table(regexp_replace(lower(search_term), '[^a-zA-Z0-9\s]+', '','g') , '\s+') AS term;
		
		--SELECT * FROM _temp_search_terms;
		DROP TABLE IF EXISTS _temp_entities_tags;
		
		CREATE TEMP TABLE _temp_entities_tags AS 
		SELECT t.tag_name, et.entity_id
		FROM tags t
		JOIN entities_tags et ON t.id = et.tag_id
		JOIN _temp_search_terms tst ON tst.term LIKE '%' || lower(t.tag_name) || '%';
		
		DROP TABLE IF EXISTS _temp_entities_comments;
		
		CREATE TEMP TABLE _temp_entities_comments AS 
		SELECT e.id AS entity_id, 
			   array_length(string_to_array(e.entity_comment, tst.term), 1) - 1 AS occurencies_count
		FROM entities e
		JOIN _temp_search_terms tst ON e.entity_comment LIKE '%' || lower(tst.term) || '%';
		
		DROP TABLE IF EXISTS _temp_entities_intent;
		
		CREATE TEMP TABLE _temp_entities_intent AS 
		SELECT i.intent_name, ei.entity_id 
		FROM intents i
		JOIN entities_intents ei ON i.id = ei.intent_id 
		JOIN _temp_search_terms tst ON tst.term LIKE '%' || lower(i.intent_name) || '%';
		
		DROP TABLE IF EXISTS _temp_entities_with_score;
		
		CREATE TEMP TABLE _temp_entities_with_score AS 
		SELECT e.id AS entity_id, 
			SUM(CASE WHEN et.entity_id IS NOT NULL THEN 10 ELSE 0 END +
			CASE WHEN ec.entity_id IS NOT NULL THEN ec.occurencies_count ELSE 0 END +
			CASE WHEN ei.entity_id IS NOT NULL THEN 5 ELSE 0 END)
			AS score
		FROM entities e
		LEFT JOIN _temp_entities_tags et ON e.id = et.entity_id
		LEFT JOIN _temp_entities_comments ec ON e.id = ec.entity_id 
		LEFT JOIN _temp_entities_intent ei ON e.id = ei.entity_id
		WHERE COALESCE (et.entity_id, ec.entity_id, ei.entity_id) IS NOT NULL
		GROUP BY (e.id);
		
		DROP TABLE IF EXISTS _temp_final_records;
		CREATE TEMP TABLE _temp_final_records AS 
		SELECT f.file_name AS "fileName",
			   r.repo_name AS "repName",
			   e.entity_comment AS "comment",
			   e.line_number AS "line",
			   e.entity_type::text AS "type",
			   tews.score AS score
		FROM _temp_entities_with_score tews 
		JOIN entities e ON tews.entity_id = e.id
		JOIN files f ON e.file_id  = f.id 
		JOIN repos r ON f.repo_id = r.id; 
	
	   RETURN QUERY 
	  		SELECT DISTINCT * 
	  		FROM _temp_final_records 
	  		ORDER BY score DESC 
	  		LIMIT 50;
       
       --SELECT array_agg(_temp_final_records.*) INTO results FROM _temp_final_records;	
      
       DROP TABLE IF EXISTS _temp_entities_with_score;
       DROP TABLE IF EXISTS _temp_search_terms;
       DROP TABLE IF EXISTS _temp_entities_tags;
       DROP TABLE IF EXISTS _temp_entities_comments;
       DROP TABLE IF EXISTS _temp_entities_intent;
 
      

   END;
   $function$
;
