export default `#ifdef GL_OES_standard_derivatives
  #extension GL_OES_standard_derivatives : enable
#endif

uniform bool u_showIntersection;
uniform bool u_showThroughEllipsoid;

uniform float u_radius;
uniform float u_xHalfAngle;
uniform float u_yHalfAngle;
uniform float u_normalDirection;
uniform vec4 u_color;

varying vec3 v_position;
varying vec3 v_positionWC;
varying vec3 v_positionEC;
varying vec3 v_normalEC;

vec4 getColor(float sensorRadius, vec3 pointEC)
{
  czm_materialInput materialInput;

  vec3 pointMC = (czm_inverseModelView * vec4(pointEC, 1.0)).xyz;
  materialInput.st = sensor2dTextureCoordinates(sensorRadius, pointMC);
  materialInput.str = pointMC / sensorRadius;

  vec3 positionToEyeEC = -v_positionEC;
  materialInput.positionToEyeEC = positionToEyeEC;

  vec3 normalEC = normalize(v_normalEC);
  materialInput.normalEC = u_normalDirection * normalEC;

  czm_material material = czm_getMaterial(materialInput);

  material.diffuse = u_color.rgb;
  material.alpha = u_color.a;

  return mix(czm_phong(normalize(positionToEyeEC), material), vec4(material.diffuse, material.alpha), 0.4);

}

bool isOnBoundary(float value, float epsilon)
{
  float width = getIntersectionWidth();
  float tolerance = width * epsilon;

#ifdef GL_OES_standard_derivatives
  float delta = max(abs(dFdx(value)), abs(dFdy(value)));
  float pixels = width * delta;
  float temp = abs(value);
  // There are a couple things going on here.
  // First we test the value at the current fragment to see if it is within the tolerance.
  // We also want to check if the value of an adjacent pixel is within the tolerance,
  // but we don't want to admit points that are obviously not on the surface.
  // For example, if we are looking for "value" to be close to 0, but value is 1 and the adjacent value is 2,
  // then the delta would be 1 and "temp - delta" would be "1 - 1" which is zero even though neither of
  // the points is close to zero.
  return temp < tolerance && temp < pixels || (delta < 10.0 * tolerance && temp - delta < tolerance && temp < pixels);
#else
  return abs(value) < tolerance;
#endif
}

vec4 shade(bool isOnBoundary)
{
  if (u_showIntersection && isOnBoundary)
  {
      return getIntersectionColor();
  }
  return getColor(u_radius, v_positionEC);
}

float ellipsoidSurfaceFunction(czm_ellipsoid ellipsoid, vec3 point)
{
  vec3 scaled = ellipsoid.inverseRadii * point;
  return dot(scaled, scaled) - 1.0;
}

void main()
{
  vec3 sensorVertexWC = czm_model[3].xyz;      // (0.0, 0.0, 0.0) in model coordinates
  vec3 sensorVertexEC = czm_modelView[3].xyz;  // (0.0, 0.0, 0.0) in model coordinates

  //vec3 pixDir = normalize(v_position);
  float positionX = v_position.x;
  float positionY = v_position.y;
  float positionZ = v_position.z;

  vec3 zDir = vec3(0.0, 0.0, 1.0);
  vec3 lineX = vec3(positionX, 0 ,positionZ);
  vec3 lineY = vec3(0, positionY, positionZ);
  float resX = dot(normalize(lineX), zDir);
  if(resX < cos(u_xHalfAngle) - 0.0001){
      discard;
  }
  float resY = dot(normalize(lineY), zDir);
  if(resY < cos(u_yHalfAngle)- 0.0001){
      discard;
  }


  czm_ellipsoid ellipsoid = czm_getWgs84EllipsoidEC();
  float ellipsoidValue = ellipsoidSurfaceFunction(ellipsoid, v_positionWC);

  // Occluded by the ellipsoid?
if (!u_showThroughEllipsoid)
{
    // Discard if in the ellipsoid
    // PERFORMANCE_IDEA: A coarse check for ellipsoid intersection could be done on the CPU first.
    if (ellipsoidValue < 0.0)
    {
          discard;
    }

    // Discard if in the sensor's shadow
    if (inSensorShadow(sensorVertexWC, ellipsoid, v_positionWC))
    {
        discard;
    }
  }

  // Notes: Each surface functions should have an associated tolerance based on the floating point error.
  bool isOnEllipsoid = isOnBoundary(ellipsoidValue, czm_epsilon3);
  gl_FragColor = shade(isOnEllipsoid);

}`
