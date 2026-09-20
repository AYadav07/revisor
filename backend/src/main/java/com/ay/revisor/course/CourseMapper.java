package com.ay.revisor.course;

import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface CourseMapper {

    CourseResponse toResponse(Course course);

    TopicResponse toResponse(Topic topic);

    SubtopicResponse toResponse(Subtopic subtopic);

    SubtopicNode toNode(Subtopic subtopic);
}
